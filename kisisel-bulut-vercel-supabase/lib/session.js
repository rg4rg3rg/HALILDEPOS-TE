import crypto from "node:crypto";
import { cookies } from "next/headers";
import { getAdminConfig } from "@/lib/env";

const COOKIE_NAME = "kisisel_bulut_session";
const SESSION_SECONDS = 60 * 60 * 8;

function sign(encodedPayload, secret) {
  return crypto.createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function createToken(username) {
  const { sessionSecret } = getAdminConfig();
  const payload = {
    username,
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_SECONDS
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encodedPayload}.${sign(encodedPayload, sessionSecret)}`;
}

function verifyToken(token) {
  try {
    const { username: adminUsername, sessionSecret } = getAdminConfig();
    const [encodedPayload, signature, extra] = String(token || "").split(".");
    if (!encodedPayload || !signature || extra) return null;
    if (!safeEqual(signature, sign(encodedPayload, sessionSecret))) return null;

    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    if (
      payload.username !== adminUsername ||
      !Number.isInteger(payload.expiresAt) ||
      payload.expiresAt <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function getSession() {
  const cookieStore = await cookies();
  return verifyToken(cookieStore.get(COOKIE_NAME)?.value);
}

export async function createSession(username) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, createToken(username), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_SECONDS
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0
  });
}
