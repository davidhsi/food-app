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

export interface Reel {
  id: string;
  /** Optional looping mp4. If absent we render an animated photo poster. */
  video?: string;
  poster: string; // image url
  /** Cuisine-keyed gradient fallback that always renders, even offline. */
  gradient: [string, string];
  emoji: string;
  caption: string;
  author: string; // creator handle
  likes: number;
  dish?: string;
}

export interface Restaurant {
  id: string;
  name: string;
  cuisines: Cuisine[];
  price: Price;
  rating: number; // 0..10 community score (Beli-style)
  popularity: number; // 0..1
  neighborhood: string;
  city: string;
  distanceKm: number;
  vibes: Vibe[];
  dietary: Dietary[];
  spice: number; // 0..3 typical heat
  tags: string[];
  signatureDishes: string[];
  blurb: string;
  reels: Reel[];
}

export interface TasteProfile {
  cuisines: Cuisine[];
  price: Price[]; // acceptable price points
  vibes: Vibe[];
  dietary: Dietary[];
  spiceTolerance: number; // 0..3
  adventurousness: number; // 0..1 — willingness to try unfamiliar cuisines
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
  score: number; // 0..100 match score
  reasons: RecommendationReason[];
}
