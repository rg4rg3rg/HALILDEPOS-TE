import { NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { isSameOrigin } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ message: "Geçersiz istek." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const username = String(body.username || "").trim().slice(0, 64);
    const password = String(body.password || "").slice(0, 256);
    const result = await authenticate(request, username, password);
    if (result.error) {
      return NextResponse.json({ message: result.error }, { status: result.status });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Giriş hatası:", error);
    return NextResponse.json({ message: "Giriş yapılamadı." }, { status: 500 });
  }
}
