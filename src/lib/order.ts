import { Allergen, Restaurant, TasteProfile, TopDish } from "./types";

/**
 * "Ordering for you" — turn a restaurant's plain `signatureDishes` into a small,
 * taste-aware ordering guide ("what should I actually get here?").
 *
 * This module is **pure and client-safe** (only domain types, no dataset or
 * server imports), so both the detail page (`OrderGuide`) and the server routes
 * (`/api/order`, `/api/assistant`) share one source of truth. The deterministic
 * `buildLocalOrderGuide` is the always-available baseline; Claude only *upgrades*
 * it when a key is set (see the routes), so the feature never depends on a key.
 *
 * Honesty rule (CLAUDE.md): we never invent dishes. Picks come only from the
 * restaurant's real `signatureDishes`; the "why" reasons from the user's taste,
 * not from facts we don't have. Nothing here implies authoritative allergen
 * safety — that's why the UI always pairs this with a "confirm with staff" note.
 */

export interface OrderPick {
  dish: string;
  /** A short, human reason this dish fits the user's taste. */
  why: string;
  /**
   * Pre-stored, dish-centric description (the rich "what it is / why it's a
   * standout" copy) from `Restaurant.dishDescriptions`, if present. Detail-only,
   * so it's populated on the full record the detail page holds, absent elsewhere.
   */
  desc?: string;
  /** Crowd-derived "what reviewers love it for" note (from `topDishes`), if any. */
  note?: string;
  /**
   * Allergens (from the user's own list) this dish *may* contain, inferred from
   * its name. A caution to verify with staff — never a guarantee either way:
   * keyword matching can't see hidden ingredients, so absence ≠ safe.
   */
  cautions?: Allergen[];
}

export interface OrderGuide {
  /** One-line lead-in — the insider tip when we have it, else a templated line. */
  intro: string;
  picks: OrderPick[];
}

const PRICE_WORD = ["", "easygoing", "mid-range", "a splurge", "a special-occasion"];

/**
 * Pick one phrasing from a pool using a string seed (e.g. a restaurant or dish
 * id). **Deterministic, not random** — the same spot always renders the same
 * line, so this is calm variation across a page, never a slot-machine reshuffle
 * on every view (CLAUDE.md: no slot-machine mechanics). Lets both chat engines
 * avoid repeating one sentence verbatim down a list.
 */
export function seededPick<T>(pool: T[], seed: string): T {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return pool[Math.abs(h) % pool.length];
}

/**
 * Normalize model-written copy to the house style: no emoji, and no em/en
 * dashes (they read "AI"). Em dashes always become a comma; en dashes only when
 * spaced, so numeric ranges like "2–3" survive. Spares the allowed text accents
 * (★ ◆ ◷ ·). Pure, so both chat routes share it.
 */
// Newlines are meaningful — replies are formatted as a scannable list (one spot
// or dish per line) — so this normalizes horizontal whitespace but PRESERVES
// line breaks (capping runs of blank lines), rather than flattening everything
// to a single line.
export function sanitizeReplyText(s: string): string {
  return s
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "") // astral emoji (surrogate pairs)
    .replace(/[✨❤⭐️]/g, "") // a few BMP emoji
    .replace(/[^\S\n]*—[^\S\n]*/g, ", ") // em dash → comma (don't span line breaks)
    .replace(/[^\S\n]+–[^\S\n]+/g, ", ") // spaced en dash → comma (keep "2–3")
    .replace(/,[^\S\n]*,/g, ",") // tidy doubled commas
    .replace(/[^\S\n]+([.,;:!?])/g, "$1") // tidy space-before-punctuation
    .replace(/[^\S\n]{2,}/g, " ") // collapse runs of spaces/tabs (keep newlines)
    .replace(/[^\S\n]*\n[^\S\n]*/g, "\n") // trim spaces around line breaks
    .replace(/\n{3,}/g, "\n\n") // cap blank lines
    .replace(/^[\s,]+/, "") // drop leading whitespace/commas
    .trim();
}

/** Join a list as natural prose: "A", "A and B", "A, B, and C". */
function joinAnd(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

/**
 * Dish-name keywords that hint at each allergen. Deliberately conservative and
 * obvious (only what's plausibly in the *name*): this is a request-time cue, not
 * an ingredient database. It can only ever ADD a "may contain" caution — it
 * never clears a dish, which is why the UI always says "ask the kitchen."
 */
const ALLERGEN_KEYWORDS: Record<Allergen, string[]> = {
  peanuts: ["peanut", "satay", "groundnut"],
  "tree nuts": [
    "almond", "cashew", "walnut", "pecan", "pistachio", "hazelnut",
    "macadamia", "pine nut", "praline", "nutella", "marzipan",
  ],
  milk: [
    "cheese", "cream", "butter", "milk", "queso", "alfredo", "parmesan",
    "mozzarella", "burrata", "paneer", "yogurt", "ghee", "gelato",
    "ice cream", "latte", "ricotta", "custard", "bechamel",
  ],
  eggs: ["egg", "omelet", "omelette", "frittata", "aioli", "mayo", "carbonara", "meringue", "quiche"],
  wheat: [
    "bread", "pasta", "noodle", "dumpling", "bun", "pizza", "flour",
    "tempura", "pancake", "toast", "brioche", "gnocchi", "ramen", "udon",
    "pierogi", "wonton", "crouton", "panko", "focaccia", "baguette",
  ],
  soy: ["soy", "tofu", "edamame", "miso", "tempeh", "teriyaki"],
  fish: [
    "fish", "salmon", "tuna", "anchovy", "cod", "trout", "branzino",
    "sardine", "ceviche", "halibut", "mackerel", "eel", "unagi",
  ],
  shellfish: [
    "shrimp", "prawn", "crab", "lobster", "crawfish", "crayfish", "scallop",
    "oyster", "clam", "mussel", "calamari", "squid", "octopus",
  ],
  sesame: ["sesame", "tahini", "hummus", "halva", "za'atar", "zaatar"],
};

const ALL_ALLERGENS = Object.keys(ALLERGEN_KEYWORDS) as Allergen[];

/** Allergens a dish *may* contain, inferred from its name (substring match). */
export function dishAllergenFlags(dishName: string): Allergen[] {
  const text = dishName.toLowerCase();
  return ALL_ALLERGENS.filter((a) =>
    ALLERGEN_KEYWORDS[a].some((kw) => text.includes(kw)),
  );
}

/** Of a dish's likely allergens, the ones the user actually avoids. */
function cautionsFor(dishName: string, allergies: Allergen[]): Allergen[] {
  if (!allergies.length) return [];
  const flags = dishAllergenFlags(dishName);
  return allergies.filter((a) => flags.includes(a));
}

/**
 * A taste-based reason this dish suits the eater, or null when nothing specific
 * applies (so callers can fall back to a review note before a generic line).
 */
function tasteWhy(
  r: Restaurant,
  profile: TasteProfile,
  seed: string,
): string | null {
  const lovedCuisine = r.cuisines.find((c) => profile.cuisines.includes(c));
  if (lovedCuisine)
    return seededPick(
      [
        `right up your alley if you love ${lovedCuisine}`,
        `an easy yes for a ${lovedCuisine} fan`,
        `exactly the ${lovedCuisine} you came for`,
      ],
      seed,
    );
  if (r.spice >= 2 && profile.spiceTolerance >= 2)
    return seededPick(
      [
        "a good call if you like heat",
        "one to get if you run toward the spice",
        "it brings the heat you're after",
      ],
      seed,
    );
  if (profile.adventurousness >= 0.6)
    return seededPick(
      [
        "a little adventurous, but worth it",
        "the off-the-beaten-path pick here",
        "a bit of a leap, but a good one",
      ],
      seed,
    );
  return null;
}

/** Neutral fallback reason — varied, but never implying crowd data we lack. */
function houseReason(seed: string): string {
  return seededPick(
    ["a house signature", "a safe bet here", "a standby on this menu"],
    seed,
  );
}

/**
 * Deterministic ordering guide from the fields we already have. Used directly
 * when there's no API key, and as the candidate/context the Claude upgrade
 * refines.
 */
export function buildLocalOrderGuide(
  r: Restaurant,
  profile: TasteProfile,
): OrderGuide {
  const allergies = profile.allergies ?? [];
  // Prefer the editorial "crowd favorite" order when present (carrying each
  // dish's review-grounded note), else the raw signature-dish order.
  const source: { dish: string; note?: string }[] = r.topDishes?.length
    ? r.topDishes.slice(0, 3)
    : r.signatureDishes.slice(0, 3).map((dish) => ({ dish }));
  // Pre-stored dish-centric descriptions, indexed by dish (whitespace/case-
  // insensitive). Detail-only, so populated only on the full record.
  const normDish = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const descByDish = new Map(
    (r.dishDescriptions ?? []).map((d) => [normDish(d.dish), d.desc]),
  );
  const picks: OrderPick[] = source.map(({ dish, note }) => {
    const cautions = cautionsFor(dish, allergies);
    // Seed per dish so the three picks for one spot don't all read identically.
    const seed = `${r.id}:${dish}`;
    const why = tasteWhy(r, profile, seed) ?? houseReason(seed);
    const desc = descByDish.get(normDish(dish));
    return {
      dish,
      why,
      ...(desc ? { desc } : {}),
      ...(note ? { note } : {}),
      ...(cautions.length ? { cautions } : {}),
    };
  });

  const priced = `${PRICE_WORD[r.price] ?? "great"} ${r.cuisines[0] ?? "neighborhood"}`;
  const intro = r.insiderTip
    ? r.insiderTip
    : picks.length
      ? seededPick(
          [
            `A ${priced} spot. Here's where I'd start.`,
            `A ${priced} spot; a couple of things stand out.`,
            `For a ${priced} spot, these are the ones to get.`,
          ],
          r.id,
        )
      : "Ask about today's standout. This spot keeps it seasonal.";

  return { intro, picks };
}

/**
 * Keep only picks whose dish is one the restaurant actually lists (case- and
 * whitespace-insensitive). Used to validate model output so we never surface an
 * invented dish.
 */
export function sanitizePicks(
  picks: unknown,
  signatureDishes: string[],
  allergies: Allergen[] = [],
): OrderPick[] {
  if (!Array.isArray(picks)) return [];
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const allowed = new Map(signatureDishes.map((d) => [norm(d), d]));
  const out: OrderPick[] = [];
  const used = new Set<string>();
  for (const p of picks) {
    const dish = typeof p?.dish === "string" ? norm(p.dish) : "";
    const canonical = allowed.get(dish);
    if (!canonical || used.has(canonical)) continue;
    used.add(canonical);
    // Trust only allergens the user actually listed; union the model's cautions
    // with our own keyword scan so an obvious one is never dropped.
    const modelCautions: Allergen[] = Array.isArray(p?.cautions)
      ? p.cautions.filter((c: unknown): c is Allergen => allergies.includes(c as Allergen))
      : [];
    const cautions = Array.from(
      new Set<Allergen>([...modelCautions, ...cautionsFor(canonical, allergies)]),
    );
    out.push({
      dish: canonical, // use our spelling, not the model's
      why: typeof p?.why === "string" && p.why.trim() ? p.why.trim() : houseReason(canonical),
      ...(cautions.length ? { cautions } : {}),
    });
  }
  return out;
}

/** The crowd "loved for" note for a dish, from the restaurant's `topDishes`. */
export function noteForDish(dish: string, topDishes?: TopDish[]): string | undefined {
  return topDishes?.find((t) => t.dish === dish)?.note;
}

/** Fold a guide into a single warm chat sentence for the concierge reply. */
export function orderGuideToReply(name: string, guide: OrderGuide): string {
  if (!guide.picks.length) {
    return `At ${name}, ${guide.intro.charAt(0).toLowerCase()}${guide.intro.slice(1)}`;
  }
  // Scannable list: a short opener, then each dish on its own line with the dish
  // name in **bold** and a brief why, so it's easy to skim. Seeded on the name so
  // a given spot always reads the same (no slot-machine).
  const opener = seededPick(
    [
      `At **${name}**, here's what I'd get:`,
      `At **${name}**, this is the order:`,
      `Here's how I'd order at **${name}**:`,
    ],
    name,
  );
  const lines = guide.picks.map((p) => `**${p.dish}**, ${p.why}.`).join("\n");
  // Surface allergen cautions across the picks — grouped by allergen so we don't
  // repeat "may contain" per dish — on their own final line, staying honest about
  // safety without ever implying a dish is allergen-free.
  const byAllergen = new Map<Allergen, string[]>();
  for (const p of guide.picks)
    for (const c of p.cautions ?? [])
      byAllergen.set(c, [...(byAllergen.get(c) ?? []), p.dish]);
  const clauses = Array.from(byAllergen, ([allergen, dishes]) =>
    `the ${joinAnd(dishes)} might contain ${allergen}`,
  );
  const caution = clauses.length
    ? `\n\nHeads up: ${joinAnd(clauses)}. Confirm with the kitchen.`
    : "";
  return `${opener}\n\n${lines}${caution}`;
}
