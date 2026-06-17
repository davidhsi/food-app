import { Allergen, Restaurant, TasteProfile } from "./types";

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

/** Why this dish might land for this eater, derived from the taste profile. */
function whyForDish(r: Restaurant, profile: TasteProfile): string {
  const lovedCuisine = r.cuisines.find((c) => profile.cuisines.includes(c));
  if (lovedCuisine) return `right up your alley if you love ${lovedCuisine}`;
  if (r.spice >= 2 && profile.spiceTolerance >= 2) return "a good call if you like heat";
  if (profile.adventurousness >= 0.6) return "a little adventurous — worth a try";
  return "a house signature";
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
  const picks: OrderPick[] = r.signatureDishes.slice(0, 3).map((dish) => {
    const cautions = cautionsFor(dish, allergies);
    return { dish, why: whyForDish(r, profile), ...(cautions.length ? { cautions } : {}) };
  });

  const intro = r.insiderTip
    ? r.insiderTip
    : picks.length
      ? `A ${PRICE_WORD[r.price] ?? "great"} ${r.cuisines[0] ?? "neighborhood"} spot — here's where I'd start.`
      : "Ask about today's standout — this spot keeps it seasonal.";

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
      why: typeof p?.why === "string" && p.why.trim() ? p.why.trim() : "a house signature",
      ...(cautions.length ? { cautions } : {}),
    });
  }
  return out;
}

/** Fold a guide into a single warm chat sentence for the concierge reply. */
export function orderGuideToReply(name: string, guide: OrderGuide): string {
  if (!guide.picks.length) {
    return `At ${name}, ${guide.intro.charAt(0).toLowerCase()}${guide.intro.slice(1)}`;
  }
  const [first, ...rest] = guide.picks;
  const lead = `At ${name}, start with the ${first.dish} — ${first.why}.`;
  const more = rest.length
    ? ` Also great: ${rest.map((p) => p.dish).join(" and ")}.`
    : "";
  // Surface any allergen cautions across the picks so the concierge reply is
  // honest about safety without ever implying a dish is allergen-free.
  const flagged = guide.picks.filter((p) => p.cautions?.length);
  const caution = flagged.length
    ? ` Heads up: ${flagged
        .map((p) => `the ${p.dish} may contain ${p.cautions!.join(", ")}`)
        .join("; ")} — confirm with the kitchen.`
    : "";
  return lead + more + caution;
}
