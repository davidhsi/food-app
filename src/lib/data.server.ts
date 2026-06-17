import { Restaurant } from "./types";
import generated from "./restaurants.generated.json";

/**
 * Server-only access to the FULL restaurant dataset — including the detail-only
 * editorial fields (`insiderTip`, `blurb`) that the client `core` dataset
 * (`data.ts`) omits.
 *
 * Import this ONLY from server code (route handlers, server components). It
 * pulls in the full ~2.6MB dataset, so importing it from a client component
 * would re-bundle everything we just split out.
 *
 * This is also the seam a future database would replace: swap the JSON read for
 * a query here and every caller (`getFullRestaurant`) stays the same.
 */
export const RESTAURANTS_FULL = generated as unknown as Restaurant[];

const byId = new Map<string, Restaurant>(
  RESTAURANTS_FULL.map((r) => [r.id, r]),
);

/** Full record (with editorial) for the detail page, by id. */
export const getFullRestaurant = (id: string): Restaurant | undefined =>
  byId.get(id);
