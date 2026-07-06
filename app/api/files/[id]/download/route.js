import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getBucket } from "@/lib/supabase";
import { getFileForUser } from "@/lib/files";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";

export async function GET(request, context) {
  const user = await requireApiUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  const { id } = await context.params;
  const file = await getFileForUser(id, user);
  if (!file || file.kind !== "file") {
    return NextResponse.json({ message: "Dosya bulunamadı." }, { status: 404 });
  }

  try {
    const { data, error } = await getBucket().createSignedUrl(file.storage_path, 60, {
      download: file.name
    });
    if (error) throw error;
    await logActivity({
      request,
      user,
      action: "file_downloaded",
      fileName: file.name,
      filePath: file.storage_path,
      details: { owner_id: file.owner_id }
    });
    return NextResponse.redirect(data.signedUrl);
  } catch (error) {
    console.error("İndirme hatası:", error);
    return NextResponse.json({ message: "İndirme bağlantısı oluşturulamadı." }, { status: 500 });
  }
}
