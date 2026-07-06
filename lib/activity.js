import { getSupabaseAdmin } from "@/lib/supabase";
import { getRequestMeta } from "@/lib/request";

export async function logActivity({
  request,
  user = null,
  username,
  action,
  fileName = null,
  filePath = null,
  success = true,
  details = {}
}) {
  try {
    const meta = request ? getRequestMeta(request) : {};
    const { error } = await getSupabaseAdmin().from("activity_logs").insert({
      user_id: user?.id || null,
      username: username || user?.username || null,
      action,
      file_name: fileName,
      file_path: filePath,
      ip_address: meta.ipAddress || null,
      user_agent: meta.userAgent || null,
      device_info: meta.deviceInfo || null,
      success,
      details
    });
    if (error) console.error("Aktivite kaydı oluşturulamadı:", error);
  } catch (error) {
    console.error("Aktivite log hatası:", error);
  }
}
