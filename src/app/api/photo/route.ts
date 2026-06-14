import { NextRequest } from "next/server";
import { photoMediaUrl } from "../../../../scripts/places";

export const runtime = "nodejs";

/**
 * Proxies a Google Places photo so the API key stays server-side.
 * GET /api/photo?ref=places/PLACE_ID/photos/PHOTO_REF
 */
export async function GET(req: NextRequest) {
  const ref = req.nextUrl.searchParams.get("ref") ?? "";
  if (!ref.startsWith("places/") || !ref.includes("/photos/")) {
    return new Response("bad ref", { status: 400 });
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
