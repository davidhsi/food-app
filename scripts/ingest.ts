import "dotenv/config";
import fs from "fs";
import path from "path";
import { Restaurant } from "../src/lib/types";
import { NEIGHBORHOODS, neighborhoodQueries } from "./neighborhoods";
import { RawPlace, searchText } from "./places";
import {
  buildBuzzNormalizer,
  cuisinesFromTypes,
  distanceFromCenterKm,
  hoursFrom,
  percentileRank,
  priceFrom,
  ratingFrom,
  slugify,
} from "./derive";
import { generateEditorial } from "./editorial";
import { readCache, writeCache } from "./cache";
import { writeCoreDataset } from "./split-data";

const OUT = path.join(process.cwd(), "src", "lib", "restaurants.generated.json");
const PER_NEIGHBORHOOD = 50;
const MIN_REVIEWS = 30;
const FOOD_TYPES = new Set([
  "restaurant", "cafe", "coffee_shop", "bakery", "bar",
  "meal_takeaway", "meal_delivery", "ice_cream_shop", "dessert_shop",
]);

// Venues that may carry a food type but aren't really eateries.
const EXCLUDE_TYPES = new Set([
  "amusement_center", "amusement_park", "bowling_alley", "night_club",
  "casino", "tourist_attraction", "shopping_mall", "supermarket",
  "grocery_store", "convenience_store", "gas_station", "lodging", "hotel",
]);

function isFood(p: RawPlace): boolean {
  return (p.types ?? []).some((t) => FOOD_TYPES.has(t));
}

function reviewSnippets(p: RawPlace): string[] {
  return (p.reviews ?? [])
    .map((r) => r.text?.text?.trim())
    .filter((t): t is string => !!t)
    .slice(0, 5);
}

async function main() {
  const sample = process.argv.includes("--sample");
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  // 1. Gather raw places (live, or from the fixture for --sample).
  const raw: { place: RawPlace; neighborhood: string }[] = [];
  if (sample) {
    const fixture = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "scripts", "fixtures", "sample-places.json"), "utf8"),
    ) as RawPlace[];
    fixture.forEach((place, i) =>
      raw.push({ place, neighborhood: i === 0 ? "Avondale" : "Pilsen" }),
    );
  } else {
    if (!apiKey) throw new Error("GOOGLE_PLACES_API_KEY is required (or pass --sample)");
    for (const n of NEIGHBORHOODS) {
      // Generic query first so a spot found by both it and a cuisine probe is
      // attributed to this neighborhood (dedupe keeps the first sighting).
      for (const q of neighborhoodQueries(n)) {
        console.log(`Searching ${n.name}: "${q}"`);
        const places = await searchText(q, apiKey, PER_NEIGHBORHOOD);
        for (const place of places) raw.push({ place, neighborhood: n.name });
      }
    }
  }

  // 2. Filter + dedupe by placeId.
  const seen = new Set<string>();
  const kept = raw.filter(({ place }) => {
    if (!place.id || seen.has(place.id)) return false;
    if (place.businessStatus && place.businessStatus !== "OPERATIONAL") return false;
    if (!isFood(place)) return false;
    if ((place.types ?? []).some((t) => EXCLUDE_TYPES.has(t))) return false;
    if (typeof place.rating !== "number") return false;
    if ((place.userRatingCount ?? 0) < MIN_REVIEWS) return false;
    if (!place.location) return false;
    seen.add(place.id);
    return true;
  });
  console.log(`Kept ${kept.length} of ${raw.length} places.`);

  // 3. Second pass: buzz + popularity normalized across the whole dataset.
  const counts = kept.map(({ place }) => place.userRatingCount ?? 0);
  const buzzOf = buildBuzzNormalizer(counts);

  // 4. Build restaurants (with cached editorial reuse).
  const restaurants: Restaurant[] = [];
  for (const { place, neighborhood } of kept) {
    const name = place.displayName?.text ?? "Unnamed";
    const derivedCuisines = cuisinesFromTypes(place.types, name);
    const price = priceFrom(place.priceLevel);
    const rating = ratingFrom(place.rating);
    const reviewCount = place.userRatingCount ?? 0;
    const lat = place.location!.latitude;
    const lng = place.location!.longitude;

    let editorial = readCache<any>(place.id)?.editorial;
    if (!editorial) {
      editorial = await generateEditorial(
        { name, cuisines: derivedCuisines, price, rating, reviewCount, reviewSnippets: reviewSnippets(place) },
        anthropicKey,
      );
      writeCache(place.id, { editorial });
    }
    const cuisines = editorial.cuisines?.length ? editorial.cuisines : derivedCuisines;

    const photoName = place.photos?.[0]?.name;
    const poster = photoName
      ? `/api/photo?ref=${encodeURIComponent(photoName)}`
      : "/api/photo?ref=";

    restaurants.push({
      id: slugify(name, place.id),
      name,
      cuisines,
      price,
      rating,
      popularity: Math.round(percentileRank(counts, reviewCount) * 100) / 100,
      buzz: Math.round(buzzOf(reviewCount) * 100) / 100,
      insiderTip: editorial.insiderTip,
      neighborhood,
      city: "Chicago",
      lat,
      lng,
      distanceKm: distanceFromCenterKm(lat, lng),
      vibes: editorial.vibes,
      dietary: editorial.dietary,
      spice: editorial.spice,
      tags: editorial.tags,
      signatureDishes: editorial.signatureDishes,
      topDishes: editorial.topDishes,
      hours: hoursFrom(place),
      blurb: editorial.blurb,
      reels: [{ poster }],
    });
  }

  restaurants.sort((a, b) => b.rating * (1 - b.buzz) - a.rating * (1 - a.buzz));
  fs.writeFileSync(OUT, JSON.stringify(restaurants, null, 2) + "\n", "utf8");
  console.log(`Wrote ${restaurants.length} restaurants to ${OUT}`);
  // Derive the client-safe core dataset (drops detail-only editorial fields).
  writeCoreDataset(restaurants);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
