export interface Neighborhood {
  name: string;
  query: string;
}

/** The 9 Chicago neighborhoods for the first pull (food identity + gem density). */
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
];

/** Reference point (the Loop) for the static distanceKm used by recommend.ts. */
export const CHICAGO_CENTER = { lat: 41.8786, lng: -87.6251 };
