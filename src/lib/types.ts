export type Price = 1 | 2 | 3 | 4; // $ .. $$$$

export type Cuisine =
  | "Italian"
  | "Japanese"
  | "Mexican"
  | "Thai"
  | "Indian"
  | "Chinese"
  | "Korean"
  | "American"
  | "French"
  | "Mediterranean"
  | "Vietnamese"
  | "Spanish"
  | "Ethiopian"
  | "African"
  | "Vegan"
  | "Seafood"
  | "BBQ"
  | "Dessert"
  | "Cafe";

export type Vibe =
  | "trendy"
  | "cozy"
  | "casual"
  | "fine-dining"
  | "late-night"
  | "date-night"
  | "group-friendly"
  | "outdoor"
  | "quick-bite"
  | "hidden-gem";

export type Dietary =
  | "vegetarian"
  | "vegan"
  | "gluten-free"
  | "halal"
  | "dairy-free";

/**
 * Major food allergens (the US "big 9"). Distinct from `Dietary` preferences:
 * these are safety-critical, so the ordering guide only ever surfaces them as
 * "may contain — ask the kitchen" cautions, never as an authoritative all-clear.
 */
export type Allergen =
  | "peanuts"
  | "tree nuts"
  | "milk"
  | "eggs"
  | "wheat"
  | "soy"
  | "fish"
  | "shellfish"
  | "sesame";

export interface Reel {
  id?: string;
  /** Optional looping mp4. If absent we render an animated photo poster. */
  video?: string;
  poster: string; // image url (or /api/photo?ref=... proxy url)
  /** Legacy fields — retained as optional, not rendered by the current UI. */
  gradient?: [string, string];
  emoji?: string;
  caption?: string;
  author?: string;
  likes?: number;
  dish?: string;
}

export interface Restaurant {
  id: string;
  name: string;
  cuisines: Cuisine[];
  price: Price;
  rating: number; // 0..10 community score (Beli-style)
  popularity: number; // 0..1 — how much in-app love it gets
  /** 0..1 mainstream awareness. Low buzz + high rating = a hidden gem. */
  buzz: number;
  /**
   * A regular's tip — how to order/visit like you're in on the secret.
   * Detail-only (see `blurb`): stripped from the client `core` dataset.
   */
  insiderTip?: string;
  neighborhood: string;
  city: string;
  /** Geocoordinates from Places — used for live, client-side distance. */
  lat: number;
  lng: number;
  distanceKm: number; // distance from the Chicago city-center reference point
  vibes: Vibe[];
  dietary: Dietary[];
  spice: number; // 0..3 typical heat
  tags: string[];
  signatureDishes: string[];
  /**
   * Editorial "about" copy. Detail-only — stripped from the client `core`
   * dataset and served per-record from the server (see `data.server.ts`), so
   * it's optional on records the client holds.
   */
  blurb?: string;
  reels: Reel[];
}

/** How "under the radar" a spot is: high quality the crowds haven't found yet. */
export function gemScore(r: Restaurant): number {
  const quality = r.rating / 10; // 0..1
  return Math.max(0, Math.min(1, quality * (1 - r.buzz)));
}

export interface TasteProfile {
  cuisines: Cuisine[];
  price: Price[]; // acceptable price points
  vibes: Vibe[];
  dietary: Dietary[];
  /**
   * Allergens the user avoids. Optional so profiles persisted before this
   * field existed still parse; read sites default to `[]`. Drives the ordering
   * guide's per-dish "may contain" cautions only — never restaurant filtering.
   */
  allergies?: Allergen[];
  spiceTolerance: number; // 0..3
  adventurousness: number; // 0..1 — willingness to try unfamiliar cuisines
  /** 0..1 — preference for under-the-radar gems over the popular hotspots. */
  undergroundBias: number;
}

export type ListType = "been" | "want";

export interface RankedEntry {
  restaurantId: string;
  score: number; // 0..10 derived from comparison position
  ts: number;
}

export interface RecommendationReason {
  label: string;
  weight: number; // contribution to score, for explainability
}

export interface ScoredRestaurant {
  restaurant: Restaurant;
  score: number; // 0..100 match score, rounded for display
  precise: number; // unrounded match score — sort on this to avoid ties
  reasons: RecommendationReason[];
}
