import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { getBucket, getSupabaseAdmin } from "@/lib/supabase";
import { collectTree, getFileForUser } from "@/lib/files";
import { isSameOrigin, sanitizeFilename } from "@/lib/security";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";

export async function PATCH(request, context) {
  const user = await requireApiUser();
  if (!isSameOrigin(request) || !user) {
    return NextResponse.json({ message: "Yetkisiz istek." }, { status: 403 });
  }
  const { id } = await context.params;
  const file = await getFileForUser(id, user);
  if (!file) return NextResponse.json({ message: "Öğe bulunamadı." }, { status: 404 });

  try {
    const body = await request.json();
    const rawName = String(body.name || "").trim();
    if (!rawName) {
      return NextResponse.json({ message: "Ad boş olamaz." }, { status: 400 });
    }
    const name = sanitizeFilename(rawName);
    const { error } = await getSupabaseAdmin().from("files").update({ name }).eq("id", id);
    if (error) throw error;
    await logActivity({
      request,
      user,
      action: file.kind === "folder" ? "folder_renamed" : "file_renamed",
      fileName: name,
      filePath: file.storage_path,
      details: { previous_name: file.name }
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Yeniden adlandırma hatası:", error);
    return NextResponse.json({ message: "Öğe yeniden adlandırılamadı." }, { status: 500 });
  }
}

export async function DELETE(request, context) {
  const user = await requireApiUser();
  if (!isSameOrigin(request) || !user) {
    return NextResponse.json({ message: "Yetkisiz istek." }, { status: 403 });
  }
  const { id } = await context.params;

  try {
    const tree = await collectTree(id, user);
    if (!tree.length) return NextResponse.json({ message: "Öğe bulunamadı." }, { status: 404 });
    const root = tree[0];
    const storagePaths = tree.filter((item) => item.kind === "file").map((item) => item.storage_path);
    if (storagePaths.length) {
      const { error: storageError } = await getBucket().remove(storagePaths);
      if (storageError) throw storageError;
    }
    const { error } = await getSupabaseAdmin().from("files").delete().eq("id", root.id);
    if (error) throw error;

    await logActivity({
      request,
      user,
      action: root.kind === "folder" ? "folder_deleted" : "file_deleted",
      fileName: root.name,
      filePath: root.storage_path,
      details: { deleted_items: tree.length }
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Silme hatası:", error);
    return NextResponse.json({ message: "Öğe silinemedi." }, { status: 500 });
  }
}
