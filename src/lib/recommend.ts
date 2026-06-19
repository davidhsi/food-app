import { RESTAURANTS, RESTAURANTS_BY_ID } from "./data";
import {
  gemScore,
  RankedEntry,
  Restaurant,
  ScoredRestaurant,
  TasteProfile,
} from "./types";
import { haversineKm } from "./geo";
import { NEIGHBORHOODS, neighborhoodCentroid } from "./neighborhoods";

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
  neighborhood?: string | null; // soft-steer the feed toward this area
  // When true, the user *explicitly* named the area (e.g. an assistant query
  // "chinese in Lakeview"). Steer hard toward it instead of the gentle feed
  // nudge — but still never empty the pool, so a thin area falls back to the
  // closest nearby spots rather than nothing.
  neighborhoodStrict?: boolean;
}

const clamp = (n: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));

const overlap = <T>(a: T[], b: T[]) => a.filter((x) => b.includes(x));

type Affinity = {
  cuisineWeight: Map<string, number>;
  vibeWeight: Map<string, number>;
};

/** Build an implicit taste vector from interaction history. */
function affinityFromHistory(state: SignalState): Affinity {
  const cuisineWeight = new Map<string, number>();
  const vibeWeight = new Map<string, number>();

  const bump = (r: Restaurant | undefined, w: number) => {
    if (!r) return;
    for (const c of r.cuisines)
      cuisineWeight.set(c, (cuisineWeight.get(c) ?? 0) + w);
    for (const v of r.vibes)
      vibeWeight.set(v, (vibeWeight.get(v) ?? 0) + w * 0.6);
  };

  const byId = (id: string) => RESTAURANTS_BY_ID.get(id);
  state.liked.forEach((id) => bump(byId(id), 1));
  state.saved.forEach((id) => bump(byId(id), 0.8));
  // Higher-ranked "been" spots teach us more about taste.
  state.ranked.forEach((e) => bump(byId(e.restaurantId), (e.score / 10) * 1.4));

  return { cuisineWeight, vibeWeight };
}

export function scoreRestaurant(
  r: Restaurant,
  state: SignalState,
  // History affinity is identical for every restaurant in a single pass, so
  // `recommend` computes it once and threads it in. Standalone callers (e.g. the
  // detail page recomputing one spot's reasons) can omit it.
  affinity: Affinity = affinityFromHistory(state),
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
  const { cuisineWeight, vibeWeight } = affinity;
  let affinityScore = 0;
  for (const c of r.cuisines) affinityScore += cuisineWeight.get(c) ?? 0;
  for (const v of r.vibes) affinityScore += vibeWeight.get(v) ?? 0;
  if (affinityScore > 0) {
    const w = Math.min(20, affinityScore * 6);
    score += w;
    reasons.push({ label: `Similar to spots you loved`, weight: w });
  }

  // 9. Proximity nudge
  score += clamp(1 - r.distanceKm / 10) * 5;

  // 9b. Neighborhood soft steer — lift the chosen area, and gently its
  // neighbors, without filtering anything out. Exact match earns an
  // explainable reason; a centroid-distance falloff keeps it a steer, not a
  // wall. Never negative, so the feed never empties.
  if (state.neighborhood) {
    const strict = state.neighborhoodStrict ?? false;
    if (r.neighborhood === state.neighborhood) {
      const w = strict ? 40 : 18;
      score += w;
      reasons.push({ label: `In ${state.neighborhood}`, weight: w });
    } else if (strict) {
      // Explicitly-named area: demote out-of-area spots so the named
      // neighborhood wins decisively, but only by a bounded amount — a far
      // spot must be dramatically better to appear, yet the pool never empties
      // (thin areas still surface the closest nearby, surfaced honestly above).
      score -= 16;
    }
    const centroid = neighborhoodCentroid(state.neighborhood);
    if (centroid) {
      const km = haversineKm(centroid.lat, centroid.lng, r.lat, r.lng);
      score += clamp(1 - km / 6) * (strict ? 16 : 10);
    }
  }

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
  const affinity = affinityFromHistory(state);
  return pool
    .map((r) => scoreRestaurant(r, state, affinity))
    .sort((a, b) => b.precise - a.precise);
}

/** Lightweight natural-language search used by the AI assistant fallback. */
export function parseQuery(q: string): Partial<TasteProfile> & {
  keywords: string[];
  neighborhood?: string;
  nearMe?: boolean;
} {
  const text = q.toLowerCase();
  const keywords = text.split(/[^a-z]+/).filter(Boolean);
  const profile: Partial<TasteProfile> & {
    keywords: string[];
    neighborhood?: string;
    nearMe?: boolean;
  } = { keywords };

  // "near me" / "around here" intent — pure detection only. The caller resolves
  // the actual location (browser geolocation) and supplies the resulting
  // neighborhood as the steer, so this stays isomorphic.
  if (
    /\b(near|around|close to|next to)\s+(me|here|us)\b|\bnear\s?by\b|\bclose\s?by\b|\baround\s+here\b/.test(
      text,
    )
  ) {
    profile.nearMe = true;
  }

  // Neighborhood mention — match against the real neighborhoods in the data.
  // Longest name first so multi-word areas ("West Loop", "Logan Square") win
  // over any shorter partial. Only names that exist in the dataset are matched,
  // since a neighborhood we can't serve isn't worth steering toward.
  const nbhd = [...NEIGHBORHOODS]
    .sort((a, b) => b.length - a.length)
    .find((n) => text.includes(n.toLowerCase()));
  if (nbhd) profile.neighborhood = nbhd;

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

/**
 * Merge the cravings expressed across a sequence of user turns into one intent,
 * so a follow-up *refines* rather than resets — "spicy thai" then "something
 * cheaper" then "what about Pilsen?" should narrow (spicy + Thai + cheap +
 * Pilsen), not start over. `userTexts` is oldest → newest (the last element is
 * the current message).
 *
 * Merge rule: the latest turn that specifies a field wins (later overrides
 * earlier), so a correction like "actually, italian" replaces an earlier "thai"
 * and "near me" then "what about Pilsen?" lands on Pilsen. Vibes are the
 * exception — they accumulate (union), since they compose rather than
 * contradict (a "date night" that's also "cozy"). Fields no turn specifies stay
 * absent, exactly like `parseQuery`, so callers fall back to the stored profile.
 */
export function mergeCravings(
  userTexts: string[],
): ReturnType<typeof parseQuery> {
  const merged: ReturnType<typeof parseQuery> = { keywords: [] };
  const vibes = new Set<string>();
  for (const text of userTexts) {
    const p = parseQuery(text);
    merged.keywords = p.keywords; // current turn's keywords (latest wins)
    if (p.cuisines?.length) merged.cuisines = p.cuisines;
    if (p.vibes?.length) p.vibes.forEach((v) => vibes.add(v));
    if (p.price?.length) merged.price = p.price;
    if (p.neighborhood) merged.neighborhood = p.neighborhood;
    if (p.spiceTolerance != null) merged.spiceTolerance = p.spiceTolerance;
    if (p.undergroundBias != null) merged.undergroundBias = p.undergroundBias;
    // "near me" is a fresh spatial intent tied to the current message (the
    // client only resolves geolocation for the latest turn), so it's
    // last-wins, not accumulated — a later non-spatial turn clears it.
    merged.nearMe = p.nearMe;
  }
  if (vibes.size) merged.vibes = Array.from(vibes) as any;
  return merged;
}
