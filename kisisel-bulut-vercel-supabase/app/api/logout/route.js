import { NextResponse } from "next/server";
import { destroySession, getSession } from "@/lib/session";
import { isSameOrigin } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request) {
  if (!isSameOrigin(request) || !(await getSession())) {
    return NextResponse.json({ message: "Yetkisiz istek." }, { status: 403 });
  }
  await destroySession();
  return NextResponse.json({ ok: true });
}
