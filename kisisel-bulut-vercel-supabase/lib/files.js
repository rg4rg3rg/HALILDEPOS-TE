import { getBucket } from "@/lib/supabase";
import { displayName } from "@/lib/security";

export async function listFiles() {
  const bucket = getBucket();
  const result = [];
  const pageSize = 1000;

  for (let page = 0; page < 10; page += 1) {
    const { data, error } = await bucket.list("files", {
      limit: pageSize,
      offset: page * pageSize,
      sortBy: { column: "created_at", order: "desc" }
    });

    if (error) throw error;
    const entries = (data || []).filter((item) => item.id && item.name);
    result.push(
      ...entries.map((item) => ({
        path: `files/${item.name}`,
        name: displayName(item.name),
        size: Number(item.metadata?.size || 0),
        createdAt: item.created_at || item.updated_at || null
      }))
    );
    if (!data || data.length < pageSize) break;
  }

  return result;
}
