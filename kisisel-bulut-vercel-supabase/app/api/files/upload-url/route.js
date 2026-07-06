import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getBucket } from "@/lib/supabase";
import { isSameOrigin, sanitizeFilename } from "@/lib/security";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024;

export async function POST(request) {
  if (!isSameOrigin(request) || !(await getSession())) {
    return NextResponse.json({ message: "Yetkisiz istek." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const size = Number(body.size);
    if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { message: "Dosya boyutu geçersiz veya 2 GB sınırını aşıyor." },
        { status: 400 }
      );
    }

    const safeName = sanitizeFilename(body.name);
    const storagePath = `files/${crypto.randomUUID()}--${safeName}`;
    const { data, error } = await getBucket().createSignedUploadUrl(storagePath, {
      upsert: false
    });
    if (error) throw error;

    return NextResponse.json(
      { signedUrl: data.signedUrl, path: storagePath },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("İmzalı yükleme URL hatası:", error);
    return NextResponse.json(
      { message: "Supabase yükleme bağlantısı oluşturulamadı." },
      { status: 500 }
    );
  }
}
