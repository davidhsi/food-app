import { FeedItem } from "@/components/ReelCard";
import { ScoredRestaurant } from "./types";

/**
 * Expand scored restaurants into a reel feed. Each restaurant contributes its
 * reels in recommendation order, carrying the match score + reasons onto the
 * first reel so the "why" badge shows once per restaurant.
 */
export function toFeedItems(scored: ScoredRestaurant[]): FeedItem[] {
  const items: FeedItem[] = [];
  for (const s of scored) {
    s.restaurant.reels.forEach((reel, i) => {
      items.push({
        restaurant: s.restaurant,
        reel,
        matchScore: i === 0 ? s.score : undefined,
        reasons: i === 0 ? s.reasons : undefined,
      });
    });
  }
  return items;
}
