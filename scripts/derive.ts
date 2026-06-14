import { Cuisine, Price } from "../src/lib/types";
import { haversineKm } from "../src/lib/geo";
import { CHICAGO_CENTER } from "./neighborhoods";

export function slugify(name: string, placeId: string): string {
  const base = name
    .toLowerCase()
    .replace(/[''']/g, "") // strip apostrophes before hyphenating
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const tail = placeId.toLowerCase().replace(/[^a-z0-9]/g, "").slice(-5);
  return `${base}-${tail}`;
}

export function ratingFrom(googleRating?: number): number {
  if (typeof googleRating !== "number") return 0;
  return Math.round(googleRating * 2 * 10) / 10; // 0..10, one decimal
}

export function priceFrom(priceLevel?: string): Price {
  switch (priceLevel) {
    case "PRICE_LEVEL_INEXPENSIVE":
      return 1;
    case "PRICE_LEVEL_MODERATE":
      return 2;
    case "PRICE_LEVEL_EXPENSIVE":
      return 3;
    case "PRICE_LEVEL_VERY_EXPENSIVE":
      return 4;
    default:
      return 2;
  }
}

// Fine-grained Places (New) type -> Truffle Cuisine.
const TYPE_TO_CUISINE: Record<string, Cuisine> = {
  italian_restaurant: "Italian",
  pizza_restaurant: "Italian",
  japanese_restaurant: "Japanese",
  ramen_restaurant: "Japanese",
  sushi_restaurant: "Japanese",
  mexican_restaurant: "Mexican",
  thai_restaurant: "Thai",
  indian_restaurant: "Indian",
  chinese_restaurant: "Chinese",
  korean_restaurant: "Korean",
  american_restaurant: "American",
  hamburger_restaurant: "American",
  french_restaurant: "French",
  mediterranean_restaurant: "Mediterranean",
  vietnamese_restaurant: "Vietnamese",
  spanish_restaurant: "Spanish",
  seafood_restaurant: "Seafood",
  barbecue_restaurant: "BBQ",
  vegan_restaurant: "Vegan",
  vegetarian_restaurant: "Vegan",
  cafe: "Cafe",
  coffee_shop: "Cafe",
  bakery: "Dessert",
  dessert_shop: "Dessert",
  ice_cream_shop: "Dessert",
  steak_house: "American",
  breakfast_restaurant: "American",
  brunch_restaurant: "American",
  diner: "American",
  fast_food_restaurant: "American",
  sandwich_shop: "American",
  deli: "American",
  pub: "American",
  greek_restaurant: "Mediterranean",
  turkish_restaurant: "Mediterranean",
  lebanese_restaurant: "Mediterranean",
  middle_eastern_restaurant: "Mediterranean",
  afghani_restaurant: "Mediterranean",
  african_restaurant: "African",
  tea_house: "Cafe",
  juice_shop: "Cafe",
  bagel_shop: "Cafe",
  donut_shop: "Dessert",
  chocolate_shop: "Dessert",
  candy_store: "Dessert",
};

// Name keyword -> Cuisine, used when types are too generic.
const NAME_HINTS: [RegExp, Cuisine][] = [
  [/\b(pho|banh mi|vietnam)\b/i, "Vietnamese"],
  [/\b(taqueria|taco|cantina|mexican|birria)\b/i, "Mexican"],
  [/\b(ramen|izakaya|sushi|udon|donburi)\b/i, "Japanese"],
  [/\b(dim sum|szechuan|sichuan|hot ?pot|dumpling)\b/i, "Chinese"],
  [/\b(trattoria|pizzeria|osteria|pasta|pizza)\b/i, "Italian"],
  [/\b(bbq|smokehouse|barbecue)\b/i, "BBQ"],
  [/\b(thai)\b/i, "Thai"],
  [/\b(curry|tandoor|masala|biryani)\b/i, "Indian"],
  [/\b(shawarma|falafel|gyro|kebab|kabob|mediterranean|hummus)\b/i, "Mediterranean"],
  [/\b(tapas)\b/i, "Spanish"],
  [/\b(boba|bubble ?tea|milk ?tea|matcha|tea)\b/i, "Cafe"],
  [/\b(cafe|coffee|espresso|roasters)\b/i, "Cafe"],
  [/\b(gelato|creamery|ice ?cream|custard|donut|doughnut|bakery|patisserie|dessert|sweets)\b/i, "Dessert"],
  [/\b(steakhouse|steak house)\b/i, "American"],
  [/\b(deli|sandwich|burger)\b/i, "American"],
];

export function cuisinesFromTypes(
  types: string[] | undefined,
  name: string,
): Cuisine[] {
  const found: Cuisine[] = [];
  for (const t of types ?? []) {
    const c = TYPE_TO_CUISINE[t];
    if (c && !found.includes(c)) found.push(c);
  }
  if (found.length) return found.slice(0, 2);
  for (const [re, c] of NAME_HINTS) {
    if (re.test(name)) return [c];
  }
  return ["American"];
}

export function distanceFromCenterKm(lat: number, lng: number): number {
  return (
    Math.round(haversineKm(CHICAGO_CENTER.lat, CHICAGO_CENTER.lng, lat, lng) * 10) /
    10
  );
}

/** Min-max normalize log(reviewCount) across the city -> buzz in 0..1. */
export function buildBuzzNormalizer(counts: number[]): (count: number) => number {
  const logs = counts.map((c) => Math.log(Math.max(1, c)));
  const min = Math.min(...logs);
  const max = Math.max(...logs);
  const span = max - min;
  return (count: number) => {
    if (span <= 0) return 0.5;
    const v = (Math.log(Math.max(1, count)) - min) / span;
    return Math.max(0, Math.min(1, v));
  };
}

/** Fraction of the dataset with a review count <= value (0..1). */
export function percentileRank(counts: number[], value: number): number {
  if (!counts.length) return 0;
  const below = counts.filter((c) => c <= value).length - 1;
  return Math.max(0, below) / Math.max(1, counts.length - 1);
}
