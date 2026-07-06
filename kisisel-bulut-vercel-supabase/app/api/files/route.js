import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getBucket } from "@/lib/supabase";
import { isSameOrigin, isValidStoragePath } from "@/lib/security";

export const runtime = "nodejs";

export async function DELETE(request) {
  if (!isSameOrigin(request) || !(await getSession())) {
    return NextResponse.json({ message: "Yetkisiz istek." }, { status: 403 });
  }

  try {
    const body = await request.json();
    if (!isValidStoragePath(body.path)) {
      return NextResponse.json({ message: "Geçersiz dosya yolu." }, { status: 400 });
    }

    const { error } = await getBucket().remove([body.path]);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Dosya silme hatası:", error);
    return NextResponse.json({ message: "Dosya silinemedi." }, { status: 500 });
  }
}
