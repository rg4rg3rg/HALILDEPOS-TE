import crypto from "node:crypto";

export function constantTimeTextEqual(left, right) {
  const leftHash = crypto.createHash("sha256").update(String(left)).digest();
  const rightHash = crypto.createHash("sha256").update(String(right)).digest();
  return crypto.timingSafeEqual(leftHash, rightHash);
}

export function isSameOrigin(request) {
  const origin = request.headers.get("origin");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost || request.headers.get("host");
  if (!origin || !host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function sanitizeFilename(value) {
  const original = String(value || "dosya");
  const basename = original.split(/[\\/]/).pop() || "dosya";
  const cleaned = basename
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, "_")
    .replace(/^\.+/, "")
    .replace(/[ .]+$/g, "");

  let result = "";
  for (const character of cleaned || "dosya") {
    if (Buffer.byteLength(result + character, "utf8") > 180) break;
    result += character;
  }
  return result || "dosya";
}

export function isValidStoragePath(value) {
  return /^files\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}--[^/\\]+$/i.test(
    String(value || "")
  );
}

export function displayName(storagePath) {
  const filename = String(storagePath).split("/").pop() || "dosya";
  const separator = filename.indexOf("--");
  return separator >= 0 ? filename.slice(separator + 2) : filename;
}
