export interface Neighborhood {
  name: string;
  query: string;
}

/**
 * Chicago neighborhoods to pull, chosen for distinct food identity + gem
 * density. `name` is the canonical label stored on each restaurant and the
 * token matched by recommend.ts's parseQuery, so keep it to what a user would
 * actually type ("Devon", not "Devon Avenue").
 */
export const NEIGHBORHOODS: Neighborhood[] = [
  { name: "Logan Square", query: "restaurants in Logan Square, Chicago" },
  { name: "Pilsen", query: "restaurants in Pilsen, Chicago" },
  { name: "West Loop", query: "restaurants in West Loop, Chicago" },
  { name: "Avondale", query: "restaurants in Avondale, Chicago" },
  { name: "Uptown", query: "restaurants on Argyle Street, Uptown, Chicago" },
  { name: "Andersonville", query: "restaurants in Andersonville, Chicago" },
  { name: "Bridgeport", query: "restaurants in Bridgeport, Chicago" },
  { name: "Chinatown", query: "restaurants in Chinatown, Chicago" },
  { name: "Lakeview", query: "restaurants in Lakeview, Chicago" },
  // Breadth: six more food-distinct areas.
  { name: "Devon", query: "restaurants on Devon Avenue, Chicago" },
  { name: "Little Village", query: "restaurants in Little Village, Chicago" },
  { name: "Greektown", query: "restaurants in Greektown, Chicago" },
  { name: "Lincoln Park", query: "restaurants in Lincoln Park, Chicago" },
  { name: "Wicker Park", query: "restaurants in Wicker Park, Chicago" },
  { name: "Hyde Park", query: "restaurants in Hyde Park, Chicago" },
];

/**
 * Depth: cuisine-targeted probes appended to each neighborhood's pull. A
 * generic "restaurants in X" query skews toward American/trendy and caps near
 * Google's ~60-result ceiling, so these surface the long tail (the lone Chinese
 * or Indian spot a broad query misses). Overlap with the generic pull is fine —
 * ingest dedupes by placeId.
 */
export const CUISINE_PROBES = [
  "Chinese", "Indian", "Thai", "Korean",
  "Vietnamese", "Japanese", "Mexican", "Ethiopian",
];

/** All Places text queries to run for a neighborhood: generic + cuisine probes. */
export function neighborhoodQueries(n: Neighborhood): string[] {
  return [
    n.query,
    ...CUISINE_PROBES.map((c) => `${c} restaurants in ${n.name}, Chicago`),
  ];
}

/** Reference point (the Loop) for the static distanceKm used by recommend.ts. */
export const CHICAGO_CENTER = { lat: 41.8786, lng: -87.6251 };
