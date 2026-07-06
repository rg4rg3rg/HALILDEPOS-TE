import { NextResponse } from "next/server";
import { requireApiUser, isAdmin } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
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
    const rawName = String(body.name || "").trim();
    if (!rawName) {
      return NextResponse.json({ message: "Geçerli bir klasör adı girin." }, { status: 400 });
    }
    const name = sanitizeFilename(rawName);

    let ownerId = user.id;
    const parentId = body.parentId || null;
    if (parentId) {
      const parent = await getFileForUser(parentId, user);
      if (!parent || parent.kind !== "folder") {
        return NextResponse.json({ message: "Üst klasör bulunamadı." }, { status: 404 });
      }
      ownerId = parent.owner_id;
    } else if (isAdmin(user) && body.ownerId) {
      ownerId = String(body.ownerId);
    }

    const { data, error } = await getSupabaseAdmin()
      .from("files")
      .insert({
        owner_id: ownerId,
        parent_id: parentId,
        name,
        kind: "folder"
      })
      .select("*")
      .single();
    if (error) throw error;

    await logActivity({
      request,
      user,
      action: "folder_created",
      fileName: name,
      details: { folder_id: data.id, owner_id: ownerId }
    });
    return NextResponse.json({ folder: data }, { status: 201 });
  } catch (error) {
    console.error("Klasör oluşturma hatası:", error);
    return NextResponse.json({ message: "Klasör oluşturulamadı." }, { status: 500 });
  }
}
