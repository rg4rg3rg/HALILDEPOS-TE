import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getBucket } from "@/lib/supabase";
import { displayName, isValidStoragePath } from "@/lib/security";

export const runtime = "nodejs";

export async function GET(request) {
  if (!(await getSession())) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const path = new URL(request.url).searchParams.get("path");
  if (!isValidStoragePath(path)) {
    return NextResponse.json({ message: "Geçersiz dosya yolu." }, { status: 400 });
  }

  try {
    const { data, error } = await getBucket().createSignedUrl(path, 60, {
      download: displayName(path)
    });
    if (error) throw error;
    return NextResponse.redirect(data.signedUrl);
  } catch (error) {
    console.error("İndirme bağlantısı hatası:", error);
    return NextResponse.json(
      { message: "İndirme bağlantısı oluşturulamadı." },
      { status: 500 }
    );
  }
}
