import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { getAdminConfig } from "@/lib/env";
import { createSession } from "@/lib/session";
import { constantTimeTextEqual, isSameOrigin } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ message: "Geçersiz istek." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const username = String(body.username || "").slice(0, 128);
    const password = String(body.password || "").slice(0, 256);
    const config = getAdminConfig();

    const usernameMatches = constantTimeTextEqual(username, config.username);
    const passwordMatches = await bcrypt.compare(password, config.passwordHash);
    if (!usernameMatches || !passwordMatches) {
      return NextResponse.json(
        { message: "Kullanıcı adı veya şifre hatalı." },
        { status: 401 }
      );
    }

    await createSession(config.username);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Giriş hatası:", error);
    return NextResponse.json({ message: "Giriş yapılamadı." }, { status: 500 });
  }
}
