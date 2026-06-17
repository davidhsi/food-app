import { Cuisine, Restaurant } from "./types";
import core from "./restaurants.core.json";

/**
 * Client-safe "core" restaurant dataset. This is the full generated dataset
 * (`npm run ingest`) minus the detail-only editorial fields (`insiderTip`,
 * `blurb`) — see `scripts/split-data.ts`. The feed, cards, search, and scorer
 * need only these fields, so this is what ships to the browser. The detail page
 * loads the full record per-id from the server (`data.server.ts`).
 *
 * The cast is required because JSON widens string-literal unions to `string`.
 */
export const RESTAURANTS = core as unknown as Restaurant[];

/**
 * id → Restaurant index, built once. Lets `getRestaurant` and the recommender's
 * affinity lookups be O(1) instead of an O(n) scan per id — meaningful now that
 * the dataset is ~1.6k records and history lookups run inside scoring.
 */
export const RESTAURANTS_BY_ID: ReadonlyMap<string, Restaurant> = new Map(
  RESTAURANTS.map((r) => [r.id, r]),
);

export const getRestaurant = (id: string) => RESTAURANTS_BY_ID.get(id);

export const ALL_CUISINES: Cuisine[] = Array.from(
  new Set(RESTAURANTS.flatMap((r) => r.cuisines)),
).sort() as Cuisine[];
