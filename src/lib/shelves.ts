import { gemScore, Restaurant, ScoredRestaurant } from "./types";

/**
 * Composes the editorial "Discover" home from the existing recommendation
 * engine — this module adds NO scoring of its own. It takes the full
 * `recommend()` output (already sorted by taste fit) plus the user's history
 * and slices it into themed shelves: a hero, then personalized carousels, with
 * the ranked remainder handed back as a deep-browse `tail`.
 *
 * Each spot is claimed by at most one shelf (priority order below), so the
 * shelf region never shows the same card twice and the `tail` excludes anything
 * already featured above.
 */

export interface Shelf {
  key: string;
  title: string;
  restaurants: Restaurant[];
}

export interface DiscoverShelves {
  hero: ScoredRestaurant | null;
  shelves: Shelf[];
  tail: Restaurant[];
}

export interface ShelfInputs {
  /** Full `recommend()` output, sorted by precise score descending. */
  scored: ScoredRestaurant[];
  cuisines: string[]; // profile.cuisines
  saved: string[]; // restaurant ids, oldest → newest
  liked: string[]; // restaurant ids, oldest → newest
  ranked: { restaurantId: string }[];
  neighborhood?: string | null; // active neighborhood steer, if any
  nameById: (id: string) => string | undefined;
}

const SHELF_SIZE = 10;
const MIN_SHELF = 3; // a carousel with fewer than this isn't worth its own row

export function buildShelves(input: ShelfInputs): DiscoverShelves {
  const { scored } = input;
  if (scored.length === 0) return { hero: null, shelves: [], tail: [] };

  const hero = scored[0];
  const ordered = scored.map((s) => s.restaurant);
  const used = new Set<string>([hero.restaurant.id]);
  const shelves: Shelf[] = [];

  // Take up to SHELF_SIZE not-yet-shown spots; register a shelf only if it
  // clears the minimum. Earlier shelves claim their spots, so order = priority.
  const pushShelf = (key: string, title: string, candidates: Restaurant[]) => {
    const picks = candidates.filter((r) => !used.has(r.id)).slice(0, SHELF_SIZE);
    if (picks.length < MIN_SHELF) return;
    picks.forEach((r) => used.add(r.id));
    shelves.push({ key, title, restaurants: picks });
  };

  // 1. The active neighborhood, when one is selected.
  if (input.neighborhood) {
    pushShelf(
      "neighborhood",
      `In ${input.neighborhood}`,
      ordered.filter((r) => r.neighborhood === input.neighborhood),
    );
  }

  // 2. Affinity — "because you saved/liked X". Only with interaction history;
  //    the engine already folds affinity into the ranking, so this is just the
  //    top of the ranked list framed around a concrete anchor spot.
  const lastSaved = input.saved[input.saved.length - 1];
  const lastLiked = input.liked[input.liked.length - 1];
  const anchorId = lastSaved ?? lastLiked ?? input.ranked[0]?.restaurantId;
  if (anchorId) {
    const anchorName = input.nameById(anchorId);
    const title = anchorName
      ? lastSaved
        ? `Because you saved ${anchorName}`
        : `More like ${anchorName}`
      : "Based on your taste";
    pushShelf("affinity", title, ordered);
  }

  // 3. Your top declared cuisine.
  const topCuisine = input.cuisines[0];
  if (topCuisine) {
    pushShelf(
      "cuisine",
      `More ${topCuisine} you'd love`,
      ordered.filter((r) => (r.cuisines as string[]).includes(topCuisine)),
    );
  }

  // 4. Under the radar — purest expression of the wedge, always present.
  pushShelf(
    "under-radar",
    "Under the radar",
    [...ordered].sort((a, b) => gemScore(b) - gemScore(a)),
  );

  // Deep-browse remainder: the ranked list minus everything featured above.
  const tail = ordered.filter((r) => !used.has(r.id));

  return { hero, shelves, tail };
}
