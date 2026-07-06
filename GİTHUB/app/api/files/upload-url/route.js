import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { requireApiUser, isAdmin } from "@/lib/auth";
import { getBucket } from "@/lib/supabase";
import { isSameOrigin, sanitizeFilename } from "@/lib/security";
import { getFileForUser } from "@/lib/files";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024;

export async function POST(request) {
  const user = await requireApiUser();
  if (!isSameOrigin(request) || !user) {
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

    let ownerId = user.id;
    let parentId = body.parentId || null;
    if (parentId) {
      const parent = await getFileForUser(parentId, user);
      if (!parent || parent.kind !== "folder") {
        return NextResponse.json({ message: "Hedef klasör bulunamadı." }, { status: 404 });
      }
      ownerId = parent.owner_id;
    } else if (isAdmin(user) && body.ownerId) {
      ownerId = String(body.ownerId);
    }

    const safeName = sanitizeFilename(body.name);
    const storagePath = `users/${ownerId}/${crypto.randomUUID()}--${safeName}`;
    const { data, error } = await getBucket().createSignedUploadUrl(storagePath, {
      upsert: false
    });
    if (error) throw error;

    return NextResponse.json(
      { signedUrl: data.signedUrl, path: storagePath, ownerId, parentId, name: safeName },
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
