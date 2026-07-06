function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Eksik ortam değişkeni: ${name}`);
  }
  return value;
}

export function getAdminConfig() {
  const username = required("ADMIN_USERNAME");
  const passwordHash = required("ADMIN_PASSWORD_HASH");
  const sessionSecret = required("SESSION_SECRET");

  if (sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET en az 32 karakter olmalıdır.");
  }

  return { username, passwordHash, sessionSecret };
}

export function getSupabaseConfig() {
  const url = required("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY");
  const bucket = required("SUPABASE_BUCKET");

  if (!url.startsWith("https://")) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL geçerli bir HTTPS adresi olmalıdır.");
  }

  return { url, serviceRoleKey, bucket };
}
