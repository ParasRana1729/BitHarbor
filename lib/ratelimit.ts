// Sliding-window per-IP rate limiter (in-memory).
// For multi-replica prod use Redis; for a self-host template this is enough
// and keeps the demo from getting its Jackett IP banned in a day.

const hits = new Map<string, number[]>();
const WINDOW_MS = 60_000;

export function checkRateLimit(
  ip: string,
  limitPerMin: number,
): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const arr = hits.get(ip) ?? [];
  const fresh = arr.filter((t) => now - t < WINDOW_MS);
  if (fresh.length >= limitPerMin) {
    const oldest = fresh[0] ?? now;
    const retryAfterSec = Math.max(
      1,
      Math.ceil((WINDOW_MS - (now - oldest)) / 1000),
    );
    hits.set(ip, fresh);
    return { allowed: false, retryAfterSec };
  }
  fresh.push(now);
  hits.set(ip, fresh);
  // opportunistic cleanup
  if (hits.size > 5000) {
    hits.forEach((v, k) => {
      if (v.length === 0 || now - (v[v.length - 1] ?? 0) > WINDOW_MS * 5) {
        hits.delete(k);
      }
    });
  }
  return { allowed: true, retryAfterSec: 0 };
}

export function getClientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || "unknown";
  return headers.get("x-real-ip")?.trim() || "unknown";
}

/** Test seam */
export function _clearRateLimits(): void {
  hits.clear();
}
