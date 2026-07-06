import { NextResponse } from "next/server";
import { logout, requireApiUser } from "@/lib/auth";
import { isSameOrigin } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request) {
  if (!isSameOrigin(request) || !(await requireApiUser())) {
    return NextResponse.json({ message: "Yetkisiz istek." }, { status: 403 });
  }
  await logout(request);
  return NextResponse.json({ ok: true });
}
