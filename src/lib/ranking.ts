import { DishRank, RankedEntry } from "./types";

/**
 * Beli-style ranking: instead of asking for a number, we insert a new spot via
 * pairwise comparisons (binary search) against the user's existing ranked list,
 * then derive a 0..10 score from its final position.
 */

export interface RankingSession {
  candidateId: string;
  // current search window into the sorted-desc list
  lo: number;
  hi: number;
  // the spot we're currently comparing against
  pivot: number;
  done: boolean;
  insertAt: number;
}

/** Start inserting `candidateId` into a list already sorted by score desc. */
export function startRanking(
  candidateId: string,
  sortedDesc: readonly unknown[],
): RankingSession {
  if (sortedDesc.length === 0) {
    return { candidateId, lo: 0, hi: 0, pivot: -1, done: true, insertAt: 0 };
  }
  const lo = 0;
  const hi = sortedDesc.length;
  const pivot = Math.floor((lo + hi) / 2);
  return { candidateId, lo, hi, pivot, done: false, insertAt: 0 };
}

/**
 * Record a comparison. `preferredCandidate` = user liked the NEW spot more than
 * the pivot. Returns the next session state (possibly done).
 */
export function recordComparison(
  s: RankingSession,
  preferredCandidate: boolean,
): RankingSession {
  let { lo, hi } = s;
  if (preferredCandidate) {
    hi = s.pivot; // new spot ranks higher → search upper half
  } else {
    lo = s.pivot + 1; // ranks lower → search lower half
  }
  if (lo >= hi) {
    return { ...s, lo, hi, done: true, insertAt: lo };
  }
  const pivot = Math.floor((lo + hi) / 2);
  return { ...s, lo, hi, pivot, done: false };
}

/** Re-derive evenly spread 0..10 scores from final ordering. */
export function rescore<T extends { score: number }>(sortedDesc: T[]): T[] {
  const n = sortedDesc.length;
  if (n === 0) return [];
  if (n === 1) return [{ ...sortedDesc[0], score: 9.0 }];
  return sortedDesc.map((e, i) => {
    // top spot ~9.7, bottom ~4.0, spread across the list
    const score = 9.7 - (i / (n - 1)) * 5.7;
    return { ...e, score: Math.round(score * 10) / 10 };
  });
}

export function insertRanked(
  sortedDesc: RankedEntry[],
  candidateId: string,
  insertAt: number,
): RankedEntry[] {
  const next = sortedDesc.filter((e) => e.restaurantId !== candidateId);
  next.splice(insertAt, 0, { restaurantId: candidateId, score: 0, ts: Date.now() });
  return rescore(next);
}

/**
 * Dish variant of `insertRanked`, keyed by dish name instead of restaurantId.
 * Reuses the same even-spread `rescore` math so personal dish ranking feels like
 * restaurant ranking. `rescore`'s `{ ...e }` spread preserves the `dish` field.
 */
export function insertDishRank(
  sortedDesc: DishRank[],
  dish: string,
  insertAt: number,
): DishRank[] {
  const next = sortedDesc.filter((e) => e.dish !== dish);
  next.splice(insertAt, 0, { dish, score: 0, ts: Date.now() });
  return rescore(next);
}
