import { getSupabaseAdmin } from "@/lib/supabase";
import { isAdmin } from "@/lib/auth";

export async function getFileForUser(id, user) {
  let query = getSupabaseAdmin().from("files").select("*").eq("id", id);
  if (!isAdmin(user)) query = query.eq("owner_id", user.id);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

export async function listDirectory(user, parentId = null) {
  let query = getSupabaseAdmin()
    .from("files")
    .select("*")
    .order("kind", { ascending: false })
    .order("name", { ascending: true });
  query = parentId ? query.eq("parent_id", parentId) : query.is("parent_id", null);
  if (!isAdmin(user)) query = query.eq("owner_id", user.id);

  const { data, error } = await query;
  if (error) throw error;

  const ownerIds = [...new Set((data || []).map((item) => item.owner_id))];
  let ownerMap = {};
  if (ownerIds.length) {
    const { data: owners, error: ownerError } = await getSupabaseAdmin()
      .from("users")
      .select("id, username")
      .in("id", ownerIds);
    if (ownerError) throw ownerError;
    ownerMap = Object.fromEntries((owners || []).map((owner) => [owner.id, owner.username]));
  }

  return (data || []).map((item) => ({
    id: item.id,
    owner_id: item.owner_id,
    parent_id: item.parent_id,
    name: item.name,
    kind: item.kind,
    mime_type: item.mime_type,
    size: item.size,
    created_at: item.created_at,
    updated_at: item.updated_at,
    owner_username: ownerMap[item.owner_id] || "Bilinmeyen"
  }));
}

export async function getBreadcrumbs(folderId, user) {
  const items = [];
  let currentId = folderId;
  for (let depth = 0; currentId && depth < 30; depth += 1) {
    const folder = await getFileForUser(currentId, user);
    if (!folder || folder.kind !== "folder") break;
    items.unshift({ id: folder.id, name: folder.name });
    currentId = folder.parent_id;
  }
  return items;
}

export async function collectTree(rootId, user) {
  const root = await getFileForUser(rootId, user);
  if (!root) return [];
  const result = [root];
  let frontier = [root.id];
  for (let depth = 0; frontier.length && depth < 50; depth += 1) {
    const { data, error } = await getSupabaseAdmin()
      .from("files")
      .select("*")
      .in("parent_id", frontier);
    if (error) throw error;
    const allowed = isAdmin(user) ? data || [] : (data || []).filter((item) => item.owner_id === user.id);
    result.push(...allowed);
    frontier = allowed.map((item) => item.id);
  }
  return result;
}
