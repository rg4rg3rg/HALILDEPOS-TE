import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { requireApiUser, isAdmin } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isSameOrigin } from "@/lib/security";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";

export async function POST(request) {
  const admin = await requireApiUser();
  if (!isSameOrigin(request) || !isAdmin(admin)) {
    return NextResponse.json({ message: "Admin yetkisi gerekli." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const username = String(body.username || "").trim();
    const password = String(body.password || "");
    const role = body.role === "admin" ? "admin" : "user";
    if (!/^[\p{L}\p{N}_.-]{3,32}$/u.test(username)) {
      return NextResponse.json({ message: "Kullanıcı adı 3-32 karakter olmalıdır." }, { status: 400 });
    }
    if (password.length < 12) {
      return NextResponse.json({ message: "Şifre en az 12 karakter olmalıdır." }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const { data, error } = await getSupabaseAdmin()
      .from("users")
      .insert({ username, password_hash: passwordHash, role })
      .select("id, username, role, active, created_at")
      .single();
    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ message: "Bu kullanıcı adı zaten kullanılıyor." }, { status: 409 });
      }
      throw error;
    }
    await logActivity({
      request,
      user: admin,
      action: "user_created",
      details: { target_user_id: data.id, target_username: data.username, role }
    });
    return NextResponse.json({ user: data }, { status: 201 });
  } catch (error) {
    console.error("Kullanıcı oluşturma hatası:", error);
    return NextResponse.json({ message: "Kullanıcı oluşturulamadı." }, { status: 500 });
  }
}
