import { NextRequest, NextResponse } from "next/server";
import { RESTAURANTS } from "@/lib/data";
import { parseQuery, recommend } from "@/lib/recommend";
import { gemScore, TasteProfile } from "@/lib/types";

export const runtime = "nodejs";

interface Body {
  query: string;
  profile: TasteProfile;
}

/**
 * AI concierge. Uses Claude when ANTHROPIC_API_KEY is set to read the user's
 * natural-language craving + taste profile and pick restaurants with a friendly
 * explanation. Falls back to the deterministic local taste engine otherwise, so
 * the feature always works without a key.
 */
export async function POST(req: NextRequest) {
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
  const localScored = recommend({
    profile: blended,
    liked: [],
    saved: [],
    ranked: [],
  }).slice(0, 8);

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (apiKey) {
    try {
      const result = await askClaude(apiKey, query, profile, localScored);
      if (result) return NextResponse.json({ ...result, engine: "claude" });
    } catch (e) {
      // fall through to local engine on any error
      console.error("Claude assistant failed, using local engine:", e);
    }
  }

  // Local fallback
  const top = localScored.slice(0, 4);
  const reply = composeLocalReply(query, top);
  return NextResponse.json({
    reply,
    restaurantIds: top.map((s) => s.restaurant.id),
    engine: "local",
  });
}

function composeLocalReply(
  query: string,
  top: ReturnType<typeof recommend>,
): string {
  if (top.length === 0)
    return "I couldn't find a great match for that — try a different craving or cuisine.";
  const first = top[0];
  const r = first.restaurant;
  const gem = gemScore(r) >= 0.55;
  const lead = gem
    ? `Off-the-radar pick: ${r.name}`
    : `I'd start with ${r.name}`;
  const tip = gem && r.insiderTip ? ` ${r.insiderTip}` : "";
  return `For "${query}", ${lead} — a ${first.score}% match for your taste.${tip} A few more lined up below.`;
}

async function askClaude(
  apiKey: string,
  query: string,
  profile: TasteProfile,
  candidates: ReturnType<typeof recommend>,
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
    "You are ReelEats' food concierge. ReelEats is about discovering UNDER-THE-RADAR spots before everyone else. " +
    "From the candidate restaurants ONLY, pick the 3-4 best for the user's request and taste profile. " +
    (leanUnderground
      ? "Favor hidden gems (low `buzz`, high `gem`) over obvious tourist hotspots unless the user explicitly asks for famous/popular places. When you pick a gem, work its insiderTip into the reply. "
      : "") +
    'Respond with STRICT JSON: {"reply": string, "restaurantIds": string[]}. ' +
    "The reply is 1-2 warm, specific sentences (mention a dish or the insider tip). restaurantIds must be ids from the candidates, best first. No prose outside JSON.";

  const userMsg =
    `User craving: "${query}"\n` +
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
    RESTAURANTS.some((r) => r.id === id),
  );
  if (!valid.length) return null;
  return { reply: String(json.reply ?? ""), restaurantIds: valid };
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
