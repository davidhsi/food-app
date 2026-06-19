import { ImageResponse } from "next/og";
import { getRestaurant } from "@/lib/data";
import { gemScore } from "@/lib/types";
import { photoMediaUrl } from "../../../../scripts/places";

export const runtime = "nodejs";
export const alt = "Truffle restaurant";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Warm Editorial palette (mirrors tailwind.config.ts).
const INK = "#1d2014";
const PAPER = "#F4F1E8";
const OLIVE = "#5c6b2e";
const GEM = "#cfe08a";

function refFromPoster(poster?: string): string | null {
  if (!poster) return null;
  const m = poster.match(/[?&]ref=([^&]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

/** Fetch the Google photo server-side and inline it so satori never has to
 *  follow a redirect (which can flake) when generating the card. */
async function loadPhoto(poster?: string): Promise<string | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const ref = refFromPoster(poster);
  if (!apiKey || !ref) return null;
  try {
    const res = await fetch(photoMediaUrl(ref, apiKey, 1200), {
      redirect: "follow",
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const ct = res.headers.get("content-type") ?? "image/jpeg";
    return `data:${ct};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: { id: string } }) {
  const r = getRestaurant(params.id);
  if (!r) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: PAPER,
            color: INK,
            fontSize: 64,
            fontWeight: 700,
          }}
        >
          Truffle
        </div>
      ),
      size,
    );
  }

  const photo = await loadPhoto(r.reels[0]?.poster);
  const score = (gemScore(r) * 10).toFixed(1);
  const meta = `${r.cuisines.join(" · ")} · ${"$".repeat(r.price)} · ${r.neighborhood}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          position: "relative",
          background: INK,
          fontFamily: "sans-serif",
        }}
      >
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt=""
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        )}
        {/* Legibility scrim */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background:
              "linear-gradient(to top, rgba(29,32,20,0.92) 0%, rgba(29,32,20,0.45) 45%, rgba(29,32,20,0.15) 100%)",
          }}
        />
        {/* Wordmark */}
        <div
          style={{
            position: "absolute",
            top: 48,
            left: 56,
            display: "flex",
            alignItems: "baseline",
            fontSize: 40,
            fontWeight: 700,
            color: PAPER,
            letterSpacing: -1,
          }}
        >
          Truffle<span style={{ color: GEM }}>.</span>
        </div>
        {/* Content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            padding: "0 56px 56px",
            position: "relative",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontSize: 30,
              fontWeight: 700,
              color: INK,
              background: GEM,
              alignSelf: "flex-start",
              padding: "8px 20px",
              borderRadius: 999,
              marginBottom: 20,
            }}
          >
            <div
              style={{
                width: 16,
                height: 16,
                background: INK,
                transform: "rotate(45deg)",
              }}
            />
            {score} gem score
          </div>
          <div
            style={{
              fontSize: 76,
              fontWeight: 700,
              color: PAPER,
              lineHeight: 1.05,
              maxWidth: 1000,
            }}
          >
            {r.name}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 18,
              fontSize: 32,
              color: PAPER,
              opacity: 0.85,
            }}
          >
            {meta}
          </div>
        </div>
        {/* Olive accent bar */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            width: "100%",
            height: 12,
            display: "flex",
            background: OLIVE,
          }}
        />
      </div>
    ),
    size,
  );
}
