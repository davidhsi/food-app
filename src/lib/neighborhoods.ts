import { RESTAURANTS } from "./data";
import { haversineKm } from "./geo";

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Neighborhood centroids, derived by averaging the lat/lng of each
 * neighborhood's spots at module load. No hardcoded coordinates, so this stays
 * correct across re-ingests of restaurants.generated.json.
 */
const centroids = (() => {
  const acc = new Map<string, { lat: number; lng: number; n: number }>();
  for (const r of RESTAURANTS) {
    const c = acc.get(r.neighborhood) ?? { lat: 0, lng: 0, n: 0 };
    c.lat += r.lat;
    c.lng += r.lng;
    c.n += 1;
    acc.set(r.neighborhood, c);
  }
  const out = new Map<string, LatLng>();
  for (const [name, c] of Array.from(acc))
    out.set(name, { lat: c.lat / c.n, lng: c.lng / c.n });
  return out;
})();

/** Distinct neighborhood names, sorted for a stable chip order. */
export const NEIGHBORHOODS: string[] = Array.from(centroids.keys()).sort();

/** Centroid of a neighborhood, or undefined if the name is unknown. */
export function neighborhoodCentroid(name: string): LatLng | undefined {
  return centroids.get(name);
}

/** The neighborhood whose centroid is closest to the given point. */
export function nearestNeighborhood(lat: number, lng: number): string {
  let best = NEIGHBORHOODS[0];
  let bestKm = Infinity;
  for (const name of NEIGHBORHOODS) {
    const c = centroids.get(name)!;
    const km = haversineKm(lat, lng, c.lat, c.lng);
    if (km < bestKm) {
      bestKm = km;
      best = name;
    }
  }
  return best;
}
