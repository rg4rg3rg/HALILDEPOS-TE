import { NextResponse } from "next/server";
import { requireApiUser, isAdmin } from "@/lib/auth";
import { getBucket, getSupabaseAdmin } from "@/lib/supabase";
import { getFileForUser } from "@/lib/files";
import { isSameOrigin, sanitizeFilename } from "@/lib/security";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";

export async function POST(request) {
  const user = await requireApiUser();
  if (!isSameOrigin(request) || !user) {
    return NextResponse.json({ message: "Yetkisiz istek." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const storagePath = String(body.path || "");
    const ownerId = String(body.ownerId || "");
    const parentId = body.parentId || null;
    if (!storagePath.startsWith(`users/${ownerId}/`) || (!isAdmin(user) && ownerId !== user.id)) {
      return NextResponse.json({ message: "Geçersiz depolama yolu." }, { status: 400 });
    }
    if (parentId) {
      const parent = await getFileForUser(parentId, user);
      if (!parent || parent.kind !== "folder" || parent.owner_id !== ownerId) {
        return NextResponse.json({ message: "Hedef klasör geçersiz." }, { status: 400 });
      }
    }

    const { data: info, error: infoError } = await getBucket().info(storagePath);
    if (infoError || !info) {
      return NextResponse.json({ message: "Yüklenen nesne doğrulanamadı." }, { status: 400 });
    }

    const name = sanitizeFilename(body.name);
    const { data: file, error } = await getSupabaseAdmin()
      .from("files")
      .insert({
        owner_id: ownerId,
        parent_id: parentId,
        name,
        kind: "file",
        storage_path: storagePath,
        mime_type: body.type || info.contentType || "application/octet-stream",
        size: Number(info.size || body.size || 0)
      })
      .select("*")
      .single();
    if (error) throw error;

    await logActivity({
      request,
      user,
      action: "file_uploaded",
      fileName: name,
      filePath: storagePath,
      details: { owner_id: ownerId, size: file.size }
    });
    return NextResponse.json({ file }, { status: 201 });
  } catch (error) {
    console.error("Yükleme tamamlama hatası:", error);
    return NextResponse.json({ message: "Dosya kaydı oluşturulamadı." }, { status: 500 });
  }
}
