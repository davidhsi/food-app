import { Cuisine, Dietary, Price, TopDish, Vibe } from "../src/lib/types";
import { sanitizeReplyText } from "../src/lib/order";

export interface EditorialInput {
  name: string;
  cuisines: Cuisine[];
  price: Price;
  rating: number;
  reviewCount: number;
  reviewSnippets: string[];
}

export interface Editorial {
  blurb: string;
  insiderTip: string;
  signatureDishes: string[];
  /** Ranked (≤3) crowd favorites distilled from reviews; each ∈ signatureDishes. */
  topDishes: TopDish[];
  vibes: Vibe[];
  tags: string[];
  dietary: Dietary[];
  spice: number;
  cuisines: Cuisine[];
}

const VIBES: Vibe[] = [
  "trendy", "cozy", "casual", "fine-dining", "late-night",
  "date-night", "group-friendly", "outdoor", "quick-bite", "hidden-gem",
];
const DIETARY: Dietary[] = ["vegetarian", "vegan", "gluten-free", "halal", "dairy-free"];
const CUISINES: Cuisine[] = [
  "Italian", "Japanese", "Mexican", "Thai", "Indian", "Chinese", "Korean",
  "American", "French", "Mediterranean", "Vietnamese", "Spanish", "Ethiopian",
  "African", "Vegan", "Seafood", "BBQ", "Dessert", "Cafe",
];

const priceStr = (p: Price) => "$".repeat(p);

/** Deterministic, no-LLM editorial — also the fallback when no key is present. */
function fallbackEditorial(input: EditorialInput): Editorial {
  const vibes: Vibe[] = [];
  if (input.price >= 4) vibes.push("fine-dining", "date-night");
  else if (input.cuisines.includes("Cafe")) vibes.push("casual", "quick-bite");
  else vibes.push("casual", "cozy");
  const spice = input.cuisines.some((c) =>
    ["Thai", "Indian", "Korean", "Mexican"].includes(c),
  )
    ? 2
    : 0;
  return {
    blurb: `A ${input.cuisines.join(" / ")} spot in the neighborhood — ${priceStr(
      input.price,
    )}, rated ${input.rating.toFixed(1)} by locals.`,
    insiderTip: "Go on a weekday — quieter, and the kitchen has more time for you.",
    signatureDishes: [],
    topDishes: [],
    vibes,
    tags: input.cuisines.map((c) => c.toLowerCase()),
    dietary: [],
    spice,
    cuisines: input.cuisines,
  };
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

export function coerce(raw: any, input: EditorialInput): Editorial {
  const fb = fallbackEditorial(input);
  if (!raw || typeof raw !== "object") return fb;
  const vibes = Array.isArray(raw.vibes)
    ? (raw.vibes.filter((v: any) => VIBES.includes(v)) as Vibe[]).slice(0, 3)
    : fb.vibes;
  const dietary = Array.isArray(raw.dietary)
    ? (raw.dietary.filter((d: any) => DIETARY.includes(d)) as Dietary[])
    : [];
  const spiceNum = Number(raw.spice);
  const spice = Number.isFinite(spiceNum) ? Math.max(0, Math.min(3, Math.round(spiceNum))) : fb.spice;
  const cuisines = Array.isArray(raw.cuisines)
    ? (raw.cuisines.filter((c: any) => CUISINES.includes(c)) as Cuisine[]).slice(0, 2)
    : [];
  const signatureDishes: string[] = Array.isArray(raw.signatureDishes)
    ? raw.signatureDishes.filter((s: any) => typeof s === "string").slice(0, 4)
    : [];
  // topDishes must be a ranked subset of signatureDishes — drop anything invented.
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const allowed = new Map(signatureDishes.map((d) => [norm(d), d]));
  const seen = new Set<string>();
  const topDishes: TopDish[] = Array.isArray(raw.topDishes)
    ? (raw.topDishes as any[])
        .map((t) => {
          const canonical = typeof t?.dish === "string" ? allowed.get(norm(t.dish)) : undefined;
          if (!canonical || seen.has(canonical)) return null;
          seen.add(canonical);
          const note = typeof t?.note === "string" && t.note.trim() ? t.note.trim() : undefined;
          return note ? { dish: canonical, note } : { dish: canonical };
        })
        .filter((t): t is TopDish => t !== null)
        .slice(0, 3)
    : [];
  return {
    blurb: typeof raw.blurb === "string" && raw.blurb.trim() ? raw.blurb.trim() : fb.blurb,
    insiderTip:
      typeof raw.insiderTip === "string" && raw.insiderTip.trim()
        ? raw.insiderTip.trim()
        : fb.insiderTip,
    signatureDishes,
    topDishes,
    vibes: vibes.length ? vibes : fb.vibes,
    tags: Array.isArray(raw.tags)
      ? raw.tags.filter((s: any) => typeof s === "string").slice(0, 5)
      : fb.tags,
    dietary,
    spice,
    cuisines: cuisines.length ? cuisines : input.cuisines,
  };
}

export interface DishDescription {
  dish: string;
  desc: string;
}

export interface DishDescInput {
  name: string;
  cuisines: Cuisine[];
  price: Price;
  /** The dishes to describe — typically the guide's picks (topDishes / first 3). */
  dishes: string[];
  /** Editorial "about" copy, if we have it — grounds the descriptions. */
  blurb?: string;
  reviewSnippets?: string[];
}

/**
 * Keep only descriptions whose dish is one we asked about, with house-style,
 * non-empty copy. Mirrors `coerce`/`sanitizePicks`: the model can never describe
 * a dish that isn't real (`dishes` ⊆ the restaurant's `signatureDishes`).
 */
export function coerceDishDescriptions(
  raw: any,
  dishes: string[],
): DishDescription[] {
  const list = Array.isArray(raw?.descriptions) ? raw.descriptions : [];
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const allowed = new Map(dishes.map((d) => [norm(d), d]));
  const seen = new Set<string>();
  const out: DishDescription[] = [];
  for (const d of list) {
    const canonical = typeof d?.dish === "string" ? allowed.get(norm(d.dish)) : undefined;
    if (!canonical || seen.has(canonical)) continue;
    const desc =
      typeof d?.desc === "string" && d.desc.trim()
        ? sanitizeReplyText(d.desc.trim())
        : "";
    if (!desc) continue;
    seen.add(canonical);
    out.push({ dish: canonical, desc }); // our spelling, not the model's
  }
  return out;
}

/**
 * Pre-generate the rich, dish-centric "what it is / why it's a standout"
 * descriptions stored in `Restaurant.dishDescriptions` and rendered instantly by
 * the detail-page order guide (Ordering Phase 3; see the decision doc). Grounded
 * only in the name/cuisine/blurb/reviews — never invents prices, awards, or
 * ingredients — and limited to the dishes we pass in (⊆ signatureDishes).
 * Returns [] without a key (the guide simply omits the description line).
 */
export async function generateDishDescriptions(
  input: DishDescInput,
  apiKey?: string,
): Promise<DishDescription[]> {
  const dishes = input.dishes.filter((d) => typeof d === "string" && d.trim()).slice(0, 3);
  if (!apiKey || dishes.length === 0) return [];
  const model = process.env.ANTHROPIC_INGEST_MODEL || "claude-haiku-4-5";
  const system =
    "You write Truffle's calm, in-the-know dish descriptions. For EACH dish provided, write 1-2 sentences on WHAT IT IS and why it's a standout at this spot, grounded ONLY in the supplied facts/cuisine/reviews. " +
    "Describe the dish itself for any diner — do NOT address 'you' or assume the reader's taste. Never invent ingredients, prices, awards, or heat levels not implied by the facts. " +
    "Sound like a friend who's eaten there, not a menu or a machine: no marketing fluff, no em dashes (use commas or periods), no emoji. " +
    'Respond with STRICT JSON only: {"descriptions": [{"dish": string, "desc": string}]}. ' +
    "Each `dish` MUST be copied verbatim from the provided dishes list. No prose outside JSON.";
  const userMsg =
    `Restaurant: ${input.name}\n` +
    `Cuisines: ${input.cuisines.join(", ")}\n` +
    `Price: ${priceStr(input.price)}\n` +
    (input.blurb ? `About: ${input.blurb}\n` : "") +
    `Dishes to describe: ${JSON.stringify(dishes)}\n` +
    (input.reviewSnippets?.length
      ? `Review snippets:\n- ${input.reviewSnippets.slice(0, 5).join("\n- ")}`
      : "");
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 500,
        system,
        messages: [{ role: "user", content: userMsg }],
      }),
    });
    if (!res.ok) throw new Error(`anthropic ${res.status}`);
    const data = await res.json();
    const text: string = data?.content?.map((b: any) => b.text).join("") ?? "";
    return coerceDishDescriptions(extractJson(text), dishes);
  } catch (e) {
    console.error(`dish descriptions skipped for "${input.name}":`, (e as Error).message);
    return [];
  }
}

export async function generateEditorial(
  input: EditorialInput,
  apiKey?: string,
): Promise<Editorial> {
  if (!apiKey) return fallbackEditorial(input);
  const model = process.env.ANTHROPIC_INGEST_MODEL || "claude-haiku-4-5";
  const system =
    "You write Truffle's calm, in-the-know restaurant copy. Use ONLY the supplied facts and review snippets — never invent awards, prices, or claims. " +
    'Respond with STRICT JSON only: {"blurb": string (1 warm sentence), "insiderTip": string (1 specific how-to-order/when-to-go tip grounded in the reviews), ' +
    '"signatureDishes": string[] (0-4, only dishes named in the reviews), ' +
    '"topDishes": [{"dish": string, "note": string}] (0-3, the dishes reviewers rave about MOST, best first; each `dish` MUST be copied verbatim from signatureDishes; `note` is a short phrase grounded in the reviews, never invented), ' +
    '"cuisines": string[] (1-2 from ' + JSON.stringify(CUISINES) + ' — the ACTUAL cuisine of the food served, judged from the reviews; correct the provided hint if it is wrong), ' +
    `"vibes": string[] (0-3 from ${JSON.stringify(VIBES)}), ` +
    `"dietary": string[] (0-3 from ${JSON.stringify(DIETARY)}), ` +
    '"tags": string[] (0-5 short descriptors), "spice": number (0-3 typical heat). No prose outside JSON.';
  const userMsg =
    `Name: ${input.name}\n` +
    `Cuisines: ${input.cuisines.join(", ")}\n` +
    `Price: ${priceStr(input.price)}\n` +
    `Rating (0-10): ${input.rating}\n` +
    `Review count: ${input.reviewCount}\n` +
    `Review snippets:\n- ${input.reviewSnippets.slice(0, 5).join("\n- ")}`;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 500,
        system,
        messages: [{ role: "user", content: userMsg }],
      }),
    });
    if (!res.ok) throw new Error(`anthropic ${res.status}`);
    const data = await res.json();
    const text: string = data?.content?.map((b: any) => b.text).join("") ?? "";
    return coerce(extractJson(text), input);
  } catch (e) {
    console.error(`editorial fallback for "${input.name}":`, (e as Error).message);
    return fallbackEditorial(input);
  }
}
