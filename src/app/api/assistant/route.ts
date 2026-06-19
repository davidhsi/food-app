import { NextRequest, NextResponse } from "next/server";
import { RESTAURANTS_FULL } from "@/lib/data.server";
import { NEIGHBORHOODS } from "@/lib/neighborhoods";
import { parseQuery, recommend } from "@/lib/recommend";
import { gemScore, Restaurant, TasteProfile } from "@/lib/types";
import { buildLocalOrderGuide, orderGuideToReply } from "@/lib/order";
import { askClaudeOrder } from "@/lib/order.server";

export const runtime = "nodejs";

interface Body {
  query: string;
  profile: TasteProfile;
  // Client-resolved nearest neighborhood, sent only for "near me" queries.
  nearNeighborhood?: string | null;
}

// Best-effort in-memory rate limit. Caps Claude spend / abuse per client. It's
// per-instance under Fluid Compute (not globally exact) — swap for a shared
// store (e.g. Upstash) if a hard global limit is ever needed.
const RATE_LIMIT = 15; // requests
const RATE_WINDOW_MS = 60_000; // per minute
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    if (hits.size > 5000) {
      // Bound memory: drop expired windows.
      hits.forEach((v, k) => {
        if (now > v.resetAt) hits.delete(k);
      });
    }
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT;
}

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : "unknown";
}

/**
 * AI concierge. Uses Claude when ANTHROPIC_API_KEY is set to read the user's
 * natural-language craving + taste profile and pick restaurants with a friendly
 * explanation. Falls back to the deterministic local taste engine otherwise, so
 * the feature always works without a key.
 */
export async function POST(req: NextRequest) {
  if (rateLimited(clientIp(req))) {
    return NextResponse.json(
      {
        error: "rate_limited",
        reply: "You're going fast — give me a moment and try that again.",
        restaurantIds: [],
      },
      { status: 429, headers: { "retry-after": "60" } },
    );
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const { query, profile } = body;
  if (!query?.trim()) {
    return NextResponse.json({ error: "empty query" }, { status: 400 });
  }

  // "What should I order at X?" — if the query is an ordering question and names
  // a real restaurant, answer with a dish guide instead of recommending spots.
  // Shares the same engine as the detail page's /api/order (see lib/order*).
  if (isOrderIntent(query)) {
    const named = findNamedRestaurant(query);
    if (named) {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      let guide = buildLocalOrderGuide(named, profile);
      let engine = "local";
      if (apiKey) {
        try {
          const upgraded = await askClaudeOrder(apiKey, named, profile);
          if (upgraded) {
            guide = upgraded;
            engine = "claude";
          }
        } catch (e) {
          console.error("Claude order guide failed, using local:", e);
        }
      }
      return NextResponse.json({
        reply: orderGuideToReply(named.name, guide),
        restaurantIds: [named.id],
        engine,
      });
    }
    // No named restaurant matched — fall through to the normal recommend flow.
  }

  // Build a strong candidate pool with the local engine first.
  const parsed = parseQuery(query);
  const blended: TasteProfile = {
    ...profile,
    cuisines: parsed.cuisines?.length ? (parsed.cuisines as any) : profile.cuisines,
    vibes: parsed.vibes?.length
      ? Array.from(new Set([...(parsed.vibes as any), ...profile.vibes]))
      : profile.vibes,
    price: parsed.price?.length ? (parsed.price as any) : profile.price,
    spiceTolerance: parsed.spiceTolerance ?? profile.spiceTolerance,
    undergroundBias: parsed.undergroundBias ?? profile.undergroundBias ?? 0.7,
  };
  // If the user named a neighborhood ("chinese in Lakeview"), steer the
  // candidate pool hard toward it so both the LLM and the local fallback pick
  // from the right area instead of the city-wide best match. A "near me" query
  // instead uses the client-resolved neighborhood (validated against the real
  // set, since it's user-supplied).
  const near =
    parsed.nearMe &&
    body.nearNeighborhood &&
    NEIGHBORHOODS.includes(body.nearNeighborhood)
      ? body.nearNeighborhood
      : null;
  const neighborhood = parsed.neighborhood ?? near;
  // Score against the FULL dataset so candidates carry the detail-only editorial
  // (insiderTip/blurb) the reply and Claude prompt use — these aren't in `core`.
  const localScored = recommend(
    {
      profile: blended,
      liked: [],
      saved: [],
      ranked: [],
      neighborhood,
      neighborhoodStrict: !!neighborhood,
    },
    RESTAURANTS_FULL,
  ).slice(0, 8);

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (apiKey) {
    try {
      const result = await askClaude(
        apiKey,
        query,
        profile,
        localScored,
        neighborhood,
      );
      if (result) return NextResponse.json({ ...result, engine: "claude" });
    } catch (e) {
      // fall through to local engine on any error
      console.error("Claude assistant failed, using local engine:", e);
    }
  }

  // Local fallback
  const top = localScored.slice(0, 4);
  const reply = composeLocalReply(query, top, neighborhood);
  return NextResponse.json({
    reply,
    restaurantIds: top.map((s) => s.restaurant.id),
    engine: "local",
  });
}

function composeLocalReply(
  query: string,
  top: ReturnType<typeof recommend>,
  neighborhood: string | null = null,
): string {
  if (top.length === 0)
    return "I couldn't find a great match for that — try a different craving or cuisine.";
  const first = top[0];
  const r = first.restaurant;
  const gem = gemScore(r) >= 0.55;
  // Be honest when the named area is thin: say the pick is nearby, don't
  // pretend it's in the requested neighborhood.
  const inArea = !neighborhood || r.neighborhood === neighborhood;
  const where = neighborhood
    ? inArea
      ? ` in ${neighborhood}`
      : ` near ${neighborhood} (it's thin on this, so this is the closest I'd send you)`
    : "";
  const lead = gem
    ? `Off-the-radar pick: ${r.name}${where}`
    : `I'd start with ${r.name}${where}`;
  const tip = gem && r.insiderTip ? ` ${r.insiderTip}` : "";
  return `For "${query}", ${lead} — a ${first.score}% match for your taste.${tip} A few more lined up below.`;
}

async function askClaude(
  apiKey: string,
  query: string,
  profile: TasteProfile,
  candidates: ReturnType<typeof recommend>,
  neighborhood: string | null = null,
) {
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
  const compact = candidates.map((s) => ({
    id: s.restaurant.id,
    name: s.restaurant.name,
    cuisines: s.restaurant.cuisines,
    price: s.restaurant.price,
    rating: s.restaurant.rating,
    buzz: s.restaurant.buzz, // 0..1 mainstream awareness; low = hidden gem
    gem: Math.round(gemScore(s.restaurant) * 100) / 100,
    vibes: s.restaurant.vibes,
    dietary: s.restaurant.dietary,
    neighborhood: s.restaurant.neighborhood,
    city: s.restaurant.city,
    signatureDishes: s.restaurant.signatureDishes,
    insiderTip: s.restaurant.insiderTip,
    blurb: s.restaurant.blurb,
  }));

  const leanUnderground = (profile.undergroundBias ?? 0.7) >= 0.5;
  const system =
    "You are Truffle's food concierge. Truffle is about discovering UNDER-THE-RADAR spots before everyone else. " +
    "From the candidate restaurants ONLY, pick the 3-4 best for the user's request and taste profile. " +
    (leanUnderground
      ? "Favor hidden gems (low `buzz`, high `gem`) over obvious tourist hotspots unless the user explicitly asks for famous/popular places. When you pick a gem, work its insiderTip into the reply. "
      : "") +
    (neighborhood
      ? `The user specifically asked for ${neighborhood}. Strongly prefer candidates whose neighborhood is "${neighborhood}". If few or none match, do NOT substitute another area silently — say plainly that ${neighborhood} is thin on this and offer the closest nearby spots from the candidates instead. `
      : "") +
    'Respond with STRICT JSON: {"reply": string, "restaurantIds": string[]}. ' +
    "The reply is 1-2 warm, specific sentences (mention a dish or the insider tip). restaurantIds must be ids from the candidates, best first. No prose outside JSON.";

  const userMsg =
    `User craving: "${query}"\n` +
    (neighborhood ? `Requested neighborhood: ${neighborhood}\n` : "") +
    `Taste profile: ${JSON.stringify(profile)}\n` +
    `Candidates: ${JSON.stringify(compact)}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 400,
      system,
      messages: [{ role: "user", content: userMsg }],
    }),
  });

  if (!res.ok) throw new Error(`anthropic ${res.status}`);
  const data = await res.json();
  const text: string =
    data?.content?.map((b: any) => b.text).join("") ?? "";
  const json = extractJson(text);
  if (!json?.restaurantIds?.length) return null;

  // Validate ids against the real dataset.
  const valid = json.restaurantIds.filter((id: string) =>
    RESTAURANTS_FULL.some((r) => r.id === id),
  );
  if (!valid.length) return null;
  return { reply: String(json.reply ?? ""), restaurantIds: valid };
}

/** Does the query read like "what should I order / get / have"? */
function isOrderIntent(query: string): boolean {
  return /(what.*(to )?(order|get|have)|what'?s good|recommend.*dish|should i (order|get))/i.test(
    query,
  );
}

/**
 * Find a restaurant the query names by matching its name as a substring.
 * Longest name first so a multi-word spot wins over a shorter partial (same
 * technique as parseQuery's neighborhood match). Short names are skipped to
 * avoid trivial false positives.
 */
function findNamedRestaurant(query: string): Restaurant | undefined {
  const text = query.toLowerCase();
  return [...RESTAURANTS_FULL]
    .filter((r) => r.name.length >= 4)
    .sort((a, b) => b.name.length - a.name.length)
    .find((r) => text.includes(r.name.toLowerCase()));
}

function extractJson(text: string): any | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}
