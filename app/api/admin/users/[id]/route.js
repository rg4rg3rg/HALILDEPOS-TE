import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { requireApiUser, isAdmin } from "@/lib/auth";
import { getBucket, getSupabaseAdmin } from "@/lib/supabase";
import { isSameOrigin } from "@/lib/security";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";

export async function PATCH(request, context) {
  const admin = await requireApiUser();
  if (!isSameOrigin(request) || !isAdmin(admin)) {
    return NextResponse.json({ message: "Admin yetkisi gerekli." }, { status: 403 });
  }
  const { id } = await context.params;
  try {
    const body = await request.json();
    const updates = {};
    if (body.password !== undefined) {
      const password = String(body.password);
      if (password.length < 12) {
        return NextResponse.json({ message: "Şifre en az 12 karakter olmalıdır." }, { status: 400 });
      }
      updates.password_hash = await bcrypt.hash(password, 12);
    }
    if (body.role !== undefined) {
      if (id === admin.id) {
        return NextResponse.json({ message: "Kendi admin rolünüzü değiştiremezsiniz." }, { status: 400 });
      }
      updates.role = body.role === "admin" ? "admin" : "user";
    }
    if (!Object.keys(updates).length) {
      return NextResponse.json({ message: "Değişiklik bulunamadı." }, { status: 400 });
    }

    const { data, error } = await getSupabaseAdmin()
      .from("users")
      .update(updates)
      .eq("id", id)
      .select("id, username, role, active")
      .single();
    if (error) throw error;
    if (updates.password_hash) {
      await getSupabaseAdmin()
        .from("sessions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("user_id", id)
        .is("revoked_at", null);
    }
    await logActivity({
      request,
      user: admin,
      action: updates.password_hash ? "user_password_changed" : "user_role_changed",
      details: { target_user_id: id, target_username: data.username, role: data.role }
    });
    return NextResponse.json({ user: data });
  } catch (error) {
    console.error("Kullanıcı güncelleme hatası:", error);
    return NextResponse.json({ message: "Kullanıcı güncellenemedi." }, { status: 500 });
  }
}

export async function DELETE(request, context) {
  const admin = await requireApiUser();
  if (!isSameOrigin(request) || !isAdmin(admin)) {
    return NextResponse.json({ message: "Admin yetkisi gerekli." }, { status: 403 });
  }
  const { id } = await context.params;
  if (id === admin.id) {
    return NextResponse.json({ message: "Kendi hesabınızı silemezsiniz." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const [{ data: target, error: targetError }, { data: files, error: fileError }] = await Promise.all([
      supabase.from("users").select("id, username").eq("id", id).maybeSingle(),
      supabase.from("files").select("storage_path").eq("owner_id", id).eq("kind", "file")
    ]);
    if (targetError) throw targetError;
    if (fileError) throw fileError;
    if (!target) return NextResponse.json({ message: "Kullanıcı bulunamadı." }, { status: 404 });
    const paths = (files || []).map((file) => file.storage_path);
    if (paths.length) {
      const { error: storageError } = await getBucket().remove(paths);
      if (storageError) throw storageError;
    }
    const { error } = await supabase.from("users").delete().eq("id", id);
    if (error) throw error;
    await logActivity({
      request,
      user: admin,
      action: "user_deleted",
      details: { target_user_id: id, target_username: target.username, deleted_files: paths.length }
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Kullanıcı silme hatası:", error);
    return NextResponse.json({ message: "Kullanıcı silinemedi." }, { status: 500 });
  }
}
