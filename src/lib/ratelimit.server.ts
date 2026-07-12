import { NextRequest } from "next/server";

/**
 * Best-effort in-memory per-IP rate limiting for API routes. Caps abuse of the
 * metered upstreams (Claude, Google Places Photo) per client. It's per-instance
 * under Fluid Compute (not globally exact) — swap for a shared store (e.g.
 * Upstash) if a hard global limit is ever needed.
 */
export function makeRateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return function rateLimited(ip: string): boolean {
    const now = Date.now();
    const entry = hits.get(ip);
    if (!entry || now > entry.resetAt) {
      hits.set(ip, { count: 1, resetAt: now + windowMs });
      if (hits.size > 5000) {
        // Bound memory: drop expired windows.
        hits.forEach((v, k) => {
          if (now > v.resetAt) hits.delete(k);
        });
      }
      return false;
    }
    entry.count += 1;
    return entry.count > limit;
  };
}

export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : "unknown";
}
