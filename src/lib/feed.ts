import { RecommendationReason, Restaurant, ScoredRestaurant } from "./types";

export interface SpotItem {
  restaurant: Restaurant;
  /** 0..100 match score for the current taste profile. */
  matchScore: number;
  reasons: RecommendationReason[];
}

/** One editorial card per scored restaurant, in recommendation order. */
export function toSpotItems(scored: ScoredRestaurant[]): SpotItem[] {
  return scored.map((s) => ({
    restaurant: s.restaurant,
    matchScore: s.score,
    reasons: s.reasons,
  }));
}
