export function getRequestMeta(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const ipAddress = (forwarded?.split(",")[0] || request.headers.get("x-real-ip") || "unknown").trim();
  const userAgent = request.headers.get("user-agent") || "unknown";
  const deviceInfo = detectDevice(userAgent);
  return { ipAddress, userAgent, deviceInfo };
}

function detectDevice(userAgent) {
  if (/tablet|ipad/i.test(userAgent)) return "Tablet";
  if (/mobile|iphone|android/i.test(userAgent)) return "Mobil";
  if (/windows/i.test(userAgent)) return "Windows masaüstü";
  if (/macintosh|mac os/i.test(userAgent)) return "macOS masaüstü";
  if (/linux/i.test(userAgent)) return "Linux masaüstü";
  return "Bilinmeyen cihaz";
}
