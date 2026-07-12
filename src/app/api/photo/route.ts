import { NextRequest } from "next/server";
import { photoMediaUrl } from "../../../../scripts/places";
import { clientIp, makeRateLimiter } from "@/lib/ratelimit.server";

export const runtime = "nodejs";

// Each CDN-miss here is a billed Places Photo call, and every valid photo ref
// ships publicly in the client dataset — so cap per-IP throughput. Generous
// enough for a real browsing session (cards lazy-load), hostile to crawlers.
const rateLimited = makeRateLimiter(120, 60_000);

/**
 * Proxies a Google Places photo so the API key stays server-side.
 * GET /api/photo?ref=places/PLACE_ID/photos/PHOTO_REF
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const ref = params.get("ref") ?? "";
  if (!ref.startsWith("places/") || !ref.includes("/photos/")) {
    return new Response("bad ref", { status: 400 });
  }
  // Only `ref` is a valid param — reject anything extra so cache-busting query
  // strings can't force CDN misses into billed upstream calls.
  if (Array.from(params.keys()).some((k) => k !== "ref")) {
    return new Response("bad request", { status: 400 });
  }
  if (rateLimited(clientIp(req))) {
    return new Response("rate limited", {
      status: 429,
      headers: { "retry-after": "60" },
    });
  }
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return new Response("not configured", { status: 503 });

  const upstream = await fetch(photoMediaUrl(ref, apiKey, 900), {
    redirect: "follow",
  });
  if (!upstream.ok || !upstream.body) {
    return new Response("upstream error", { status: 502 });
  }
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "image/jpeg",
      // Hero photos rarely change — cache hard to bound Places Photo cost.
      "cache-control": "public, max-age=604800, immutable",
    },
  });
}
