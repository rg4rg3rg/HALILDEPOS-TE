import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/env";

let cachedClient;

export function getSupabaseAdmin() {
  if (cachedClient) return cachedClient;
  const { url, serviceRoleKey } = getSupabaseConfig();
  cachedClient = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  return cachedClient;
}

export function getBucket() {
  const { bucket } = getSupabaseConfig();
  return getSupabaseAdmin().storage.from(bucket);
}
