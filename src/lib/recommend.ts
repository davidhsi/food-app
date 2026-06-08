import { RESTAURANTS } from "./data";
import {
  gemScore,
  RankedEntry,
  Restaurant,
  ScoredRestaurant,
  TasteProfile,
} from "./types";

/**
 * Content-based recommendation engine with explainable scoring.
 *
 * Each restaurant is scored against (1) the user's declared taste profile and
 * (2) an implicit profile learned from places they've liked/saved/ranked. Every
 * scoring component emits a human-readable reason so the feed can show *why* a
 * spot was surfaced — the explainability layer of the AI recommender.
 */

export interface SignalState {
  profile: TasteProfile;
  liked: string[]; // restaurant ids the user liked
  saved: string[]; // restaurant ids saved to "want to try"
  ranked: RankedEntry[]; // been-to + score
  seen?: string[]; // already shown — gently down-rank
}

const clamp = (n: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));

const overlap = <T>(a: T[], b: T[]) => a.filter((x) => b.includes(x));

/** Build an implicit taste vector from interaction history. */
function affinityFromHistory(state: SignalState) {
  const cuisineWeight = new Map<string, number>();
  const vibeWeight = new Map<string, number>();

  const bump = (r: Restaurant | undefined, w: number) => {
    if (!r) return;
    for (const c of r.cuisines)
      cuisineWeight.set(c, (cuisineWeight.get(c) ?? 0) + w);
    for (const v of r.vibes)
      vibeWeight.set(v, (vibeWeight.get(v) ?? 0) + w * 0.6);
  };

  const byId = (id: string) => RESTAURANTS.find((r) => r.id === id);
  state.liked.forEach((id) => bump(byId(id), 1));
  state.saved.forEach((id) => bump(byId(id), 0.8));
  // Higher-ranked "been" spots teach us more about taste.
  state.ranked.forEach((e) => bump(byId(e.restaurantId), (e.score / 10) * 1.4));

  return { cuisineWeight, vibeWeight };
}

export function scoreRestaurant(
  r: Restaurant,
  state: SignalState,
): ScoredRestaurant {
  const { profile } = state;
  const reasons: ScoredRestaurant["reasons"] = [];
  let score = 0;

  // 1. Declared cuisine match
  const cuisineHits = overlap(r.cuisines, profile.cuisines);
  if (cuisineHits.length) {
    const w = Math.min(26, cuisineHits.length * 18);
    score += w;
    reasons.push({ label: `You love ${cuisineHits[0]}`, weight: w });
  }

  // 2. Price fit
  if (profile.price.length === 0 || profile.price.includes(r.price)) {
    score += 8;
    reasons.push({ label: `In your price range`, weight: 8 });
  } else {
    const nearest = Math.min(...profile.price.map((p) => Math.abs(p - r.price)));
    score -= nearest * 4;
  }

  // 3. Vibe overlap
  const vibeHits = overlap(r.vibes, profile.vibes);
  if (vibeHits.length) {
    const w = Math.min(16, vibeHits.length * 8);
    score += w;
    reasons.push({ label: `${vibeHits[0].replace("-", " ")} vibe`, weight: w });
  }

  // 4. Dietary — these are closer to hard constraints.
  if (profile.dietary.length) {
    const satisfied = profile.dietary.every((d) => r.dietary.includes(d));
    if (satisfied) {
      score += 14;
      reasons.push({ label: `Fits your dietary needs`, weight: 14 });
    } else {
      score -= 30; // strongly demote spots that can't accommodate
    }
  }

  // 5. Spice alignment
  const spiceGap = Math.abs(r.spice - profile.spiceTolerance);
  if (r.spice >= 2 && profile.spiceTolerance >= 2) {
    score += 6;
    reasons.push({ label: `Brings the heat 🌶️`, weight: 6 });
  } else {
    score -= spiceGap * 2;
  }

  // 6. Adventurousness — reward novelty for explorers.
  const isNovel = cuisineHits.length === 0;
  if (isNovel) {
    const w = profile.adventurousness * 14;
    score += w;
    if (profile.adventurousness > 0.5)
      reasons.push({ label: `New cuisine to explore`, weight: w });
  }

  // 7. Base quality (community score + popularity)
  const quality = (r.rating / 10) * 16 + r.popularity * 8;
  score += quality;
  if (r.rating >= 9)
    reasons.push({ label: `Top-rated ${r.rating.toFixed(1)}`, weight: 16 });

  // 7b. Underground bias — the heart of the "find it first" wedge.
  // Reward high-quality, low-buzz gems; when the user leans underground,
  // also nudge down the obvious, crowded hotspots.
  const gem = gemScore(r); // 0..1: great but not yet famous
  const bias = profile.undergroundBias ?? 0.5;
  if (bias > 0) {
    const w = bias * gem * 30;
    score += w;
    if (gem >= 0.45 && bias >= 0.4)
      reasons.push({
        label: r.buzz <= 0.35 ? `Under the radar 💎` : `Local gem`,
        weight: w,
      });
  }
  // Demote tourist-trap mainstream spots for gem-seekers.
  if (bias >= 0.6 && r.buzz >= 0.8) score -= (bias - 0.5) * r.buzz * 16;

  // 8. Implicit affinity from history (content-based collaborative signal)
  const { cuisineWeight, vibeWeight } = affinityFromHistory(state);
  let affinity = 0;
  for (const c of r.cuisines) affinity += cuisineWeight.get(c) ?? 0;
  for (const v of r.vibes) affinity += vibeWeight.get(v) ?? 0;
  if (affinity > 0) {
    const w = Math.min(20, affinity * 6);
    score += w;
    reasons.push({ label: `Similar to spots you loved`, weight: w });
  }

  // 9. Proximity nudge
  score += clamp(1 - r.distanceKm / 10) * 5;

  // 10. Novelty / already-seen damping
  if (state.seen?.includes(r.id)) score -= 12;

  // Normalize to a friendly 0..100 match score. Divisor accounts for the
  // added underground dimension so scores keep a believable spread.
  const precise = clamp(score / 125) * 100;

  reasons.sort((a, b) => b.weight - a.weight);
  return {
    restaurant: r,
    score: Math.round(precise),
    precise,
    reasons: reasons.slice(0, 3),
  };
}

export function recommend(
  state: SignalState,
  pool: Restaurant[] = RESTAURANTS,
): ScoredRestaurant[] {
  return pool
    .map((r) => scoreRestaurant(r, state))
    .sort((a, b) => b.precise - a.precise);
}

/** Lightweight natural-language search used by the AI assistant fallback. */
export function parseQuery(q: string): Partial<TasteProfile> & {
  keywords: string[];
} {
  const text = q.toLowerCase();
  const keywords = text.split(/[^a-z]+/).filter(Boolean);
  const profile: Partial<TasteProfile> & { keywords: string[] } = { keywords };

  const cuisineMap: Record<string, string> = {
    pizza: "Italian",
    pasta: "Italian",
    italian: "Italian",
    ramen: "Japanese",
    sushi: "Japanese",
    japanese: "Japanese",
    taco: "Mexican",
    tacos: "Mexican",
    mexican: "Mexican",
    birria: "Mexican",
    thai: "Thai",
    curry: "Thai",
    indian: "Indian",
    korean: "Korean",
    kbbq: "Korean",
    bbq: "BBQ",
    brisket: "BBQ",
    burger: "American",
    burgers: "American",
    american: "American",
    french: "French",
    pastry: "Cafe",
    coffee: "Cafe",
    cafe: "Cafe",
    seafood: "Seafood",
    paella: "Spanish",
    spanish: "Spanish",
    vegan: "Vegan",
    vegetarian: "Vegan",
    pho: "Vietnamese",
    vietnamese: "Vietnamese",
    dumpling: "Chinese",
    dumplings: "Chinese",
    chinese: "Chinese",
    ethiopian: "Ethiopian",
    dessert: "Dessert",
  };
  const cuisines = new Set<string>();
  for (const k of keywords) if (cuisineMap[k]) cuisines.add(cuisineMap[k]);
  if (cuisines.size) profile.cuisines = Array.from(cuisines) as any;

  const vibes: string[] = [];
  if (/(late|night|midnight|2am)/.test(text)) vibes.push("late-night");
  if (/(date|romantic)/.test(text)) vibes.push("date-night");
  if (/(group|friends|crew|party)/.test(text)) vibes.push("group-friendly");
  if (/(cozy|chill)/.test(text)) vibes.push("cozy");
  if (/(quick|fast|grab)/.test(text)) vibes.push("quick-bite");
  if (/(trendy|hip|aesthetic)/.test(text)) vibes.push("trendy");
  if (vibes.length) profile.vibes = vibes as any;

  if (/(cheap|budget|affordable)/.test(text)) profile.price = [1] as any;
  if (/(fancy|upscale|fine|nice)/.test(text)) profile.price = [3, 4] as any;
  if (/(spicy|spice|hot)/.test(text)) profile.spiceTolerance = 3;

  // Underground intent — push hard toward gems.
  if (
    /(hidden|gem|underground|secret|hole|dive|off the|under the radar|locals?|undiscovered|no.?reservation|tucked)/.test(
      text,
    )
  )
    profile.undergroundBias = 0.95;
  if (/(popular|famous|hot ?spot|iconic|best known|everyone)/.test(text))
    profile.undergroundBias = 0.15;

  return profile;
}
