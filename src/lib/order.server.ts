import { Restaurant, TasteProfile } from "./types";
import {
  buildLocalOrderGuide,
  OrderGuide,
  sanitizePicks,
} from "./order";

/**
 * Server-only Claude upgrade for the ordering guide. Shared by `/api/order`
 * (detail page) and `/api/assistant` (concierge "what should I order at X")
 * so the prompt + validation live in one place.
 *
 * Mirrors the key-less-fallback pattern in `src/app/api/assistant/route.ts`:
 * uses the API key when present, returns `null` on any failure so callers fall
 * back to the deterministic `buildLocalOrderGuide`. Picks are validated against
 * the restaurant's real `signatureDishes` (`sanitizePicks`) so the model can
 * never surface an invented dish.
 */
export async function askClaudeOrder(
  apiKey: string,
  r: Restaurant,
  profile: TasteProfile,
): Promise<OrderGuide | null> {
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

  const system =
    "You are Truffle's ordering guide. The user is at (or considering) one restaurant and wants to know WHAT TO ORDER for their taste. " +
    "Pick 2-3 dishes ONLY from the provided `signatureDishes` list — never invent or substitute a dish that isn't in that list. " +
    "For each pick, give a short, warm reason it suits the taste profile (cuisine, spice, vibe). " +
    "Write a 1-sentence `intro` that sets up the order (use the insider tip if it helps). " +
    'Respond with STRICT JSON: {"intro": string, "picks": [{"dish": string, "why": string}]}. ' +
    "Each `dish` must match an entry in signatureDishes verbatim. No prose outside JSON.";

  const userMsg =
    `Restaurant: ${r.name}\n` +
    `Cuisines: ${r.cuisines.join(", ")}\n` +
    `Price: ${"$".repeat(r.price)}\n` +
    `signatureDishes: ${JSON.stringify(r.signatureDishes)}\n` +
    (r.insiderTip ? `Insider tip: ${r.insiderTip}\n` : "") +
    (r.blurb ? `About: ${r.blurb}\n` : "") +
    `Taste profile: ${JSON.stringify(profile)}`;

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
  const text: string = data?.content?.map((b: any) => b.text).join("") ?? "";
  const json = extractJson(text);
  if (!json) return null;

  const picks = sanitizePicks(json.picks, r.signatureDishes);
  if (!picks.length) return null; // nothing valid — let caller fall back

  const intro =
    typeof json.intro === "string" && json.intro.trim()
      ? json.intro.trim()
      : buildLocalOrderGuide(r, profile).intro;

  return { intro, picks };
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
