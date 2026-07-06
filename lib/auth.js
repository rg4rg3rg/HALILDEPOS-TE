import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { getAdminConfig } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getRequestMeta } from "@/lib/request";
import { logActivity } from "@/lib/activity";

const COOKIE_NAME = "kisisel_bulut_session";
const SESSION_HOURS = 8;
const LOGIN_WINDOW_MINUTES = 15;
const LOGIN_LIMIT = 5;

function hashToken(token) {
  const { sessionSecret } = getAdminConfig();
  return crypto.createHmac("sha256", sessionSecret).update(token).digest("hex");
}

async function ensureBootstrapAdmin() {
  const config = getAdminConfig();
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("users")
    .select("id, username, password_hash, role, active")
    .eq("username", config.username)
    .maybeSingle();

  if (error) throw error;
  if (data) return data;

  const { data: created, error: createError } = await supabase
    .from("users")
    .insert({
      username: config.username,
      password_hash: config.passwordHash,
      role: "admin",
      active: true
    })
    .select("id, username, password_hash, role, active")
    .single();
  if (createError) throw createError;
  return created;
}

async function countRecentFailures(username, ipAddress) {
  const since = new Date(Date.now() - LOGIN_WINDOW_MINUTES * 60 * 1000).toISOString();
  const base = () =>
    getSupabaseAdmin()
      .from("activity_logs")
      .select("id", { count: "exact", head: true })
      .eq("action", "failed_login")
      .eq("success", false)
      .gte("created_at", since);

  const [byIp, byUsername] = await Promise.all([
    base().eq("ip_address", ipAddress),
    base().eq("username", username)
  ]);
  if (byIp.error) throw byIp.error;
  if (byUsername.error) throw byUsername.error;
  return Math.max(byIp.count || 0, byUsername.count || 0);
}

export async function authenticate(request, username, password) {
  const meta = getRequestMeta(request);
  if ((await countRecentFailures(username, meta.ipAddress)) >= LOGIN_LIMIT) {
    return { error: "Çok fazla giriş denemesi. 15 dakika sonra tekrar deneyin.", status: 429 };
  }

  const bootstrap = await ensureBootstrapAdmin();
  const { data: existing, error } = await getSupabaseAdmin()
    .from("users")
    .select("id, username, password_hash, role, active")
    .eq("username", username)
    .maybeSingle();
  if (error) throw error;

  const candidate = existing || (username === bootstrap.username ? bootstrap : null);
  const comparisonHash = candidate?.password_hash || getAdminConfig().passwordHash;
  const passwordMatches = await bcrypt.compare(password, comparisonHash);
  const valid = Boolean(candidate?.active && passwordMatches);
  if (!valid) {
    await logActivity({
      request,
      user: candidate,
      username,
      action: "failed_login",
      success: false
    });
    return { error: "Kullanıcı adı veya şifre hatalı.", status: 401 };
  }

  const token = crypto.randomBytes(48).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);
  const { error: sessionError } = await getSupabaseAdmin().from("sessions").insert({
    user_id: candidate.id,
    token_hash: hashToken(token),
    ip_address: meta.ipAddress,
    user_agent: meta.userAgent,
    device_info: meta.deviceInfo,
    expires_at: expiresAt.toISOString()
  });
  if (sessionError) throw sessionError;

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_HOURS * 60 * 60
  });
  await logActivity({ request, user: candidate, action: "login" });
  return { user: candidate };
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const now = new Date().toISOString();
  const { data: session, error } = await getSupabaseAdmin()
    .from("sessions")
    .select("id, user_id, expires_at, revoked_at, last_seen_at")
    .eq("token_hash", hashToken(token))
    .is("revoked_at", null)
    .gt("expires_at", now)
    .maybeSingle();
  if (error || !session) return null;

  const { data: user, error: userError } = await getSupabaseAdmin()
    .from("users")
    .select("id, username, role, active, created_at")
    .eq("id", session.user_id)
    .eq("active", true)
    .maybeSingle();
  if (userError || !user) return null;

  if (Date.now() - new Date(session.last_seen_at).getTime() > 5 * 60 * 1000) {
    const { error: updateError } = await getSupabaseAdmin()
      .from("sessions")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", session.id);
    if (updateError) console.error("Oturum son kullanım zamanı güncellenemedi:", updateError);
  }

  return { ...user, sessionId: session.id };
}

export async function logout(request) {
  const user = await getCurrentUser();
  if (user) {
    await getSupabaseAdmin()
      .from("sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", user.sessionId);
    await logActivity({ request, user, action: "logout" });
  }
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0
  });
}

export async function requireApiUser() {
  return getCurrentUser();
}

export function isAdmin(user) {
  return user?.role === "admin";
}
