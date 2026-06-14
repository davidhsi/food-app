# Real Chicago Data Ingestion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Truffle's mock `RESTAURANTS` array with a real, refreshable dataset of Chicago restaurants ingested from the Google Places API, deriving the "hidden gem" signal from review counts and generating editorial copy with Claude.

**Architecture:** A standalone TypeScript pipeline (`scripts/ingest.ts`, run via `npx tsx`, never during deploy) searches Google Places per neighborhood, derives gem fields, generates editorial copy with Claude Haiku, and writes `src/lib/restaurants.generated.json`. `data.ts` imports that JSON at build time, so the recommender, ranking, store, and all pages keep working unchanged. Real photos are served through a same-origin proxy route that keeps the API key server-side.

**Tech stack:** Next.js 14 App Router, TypeScript (strict), `tsx` for scripts, `dotenv` for script env, Google Places API (New) via `fetch`, Anthropic Messages API via `fetch` (mirrors `src/app/api/assistant/route.ts`).

**Verification model (no test runner, per CLAUDE.md):** The gate is `npm run typecheck && npm run build`, plus `node:assert`-based check scripts run with `npx tsx` for pure logic, live smoke runs for API code, and targeted `grep`. Do NOT add jest/vitest.

---

## File structure

**New files**
- `scripts/neighborhoods.ts` — the 9 Chicago neighborhoods + city-center reference point.
- `scripts/places.ts` — Google Places API (New) client: text search + photo URL builder.
- `scripts/derive.ts` — pure derivation: id, rating, price, cuisine mapping, haversine-backed distance, buzz normalization, percentile.
- `scripts/derive.check.ts` — `node:assert` checks for `derive.ts`.
- `scripts/editorial.ts` — Claude Haiku editorial generation with a deterministic no-key fallback.
- `scripts/editorial.check.ts` — `node:assert` checks for the editorial fallback.
- `scripts/cache.ts` — file cache keyed by placeId under `scripts/.ingest-cache/`.
- `scripts/fixtures/sample-places.json` — 2 canned `RawPlace` records for `--sample` runs and checks.
- `scripts/ingest.ts` — orchestrator; writes `src/lib/restaurants.generated.json`.
- `scripts/validate-data.ts` — invariant checks on the generated JSON.
- `src/lib/geo.ts` — pure `haversineKm` (shared by ingest + client).
- `src/components/UserDistance.tsx` — `"use client"` component: live distance via geolocation, else nothing.
- `src/app/api/photo/route.ts` — photo proxy (server-side key).
- `src/lib/restaurants.generated.json` — generated dataset (committed).

**Modified files**
- `package.json` — add `tsx`, `dotenv` devDeps; add `ingest` + `validate-data` scripts.
- `.gitignore` — ignore `scripts/.ingest-cache/`.
- `.env.example` — document `GOOGLE_PLACES_API_KEY`, `ANTHROPIC_API_KEY`.
- `tsconfig.json` — ensure `resolveJsonModule` + exclude `scripts` from the Next build typecheck path is NOT needed (scripts are typechecked too; that's fine).
- `src/lib/types.ts` — add `lat`/`lng` to `Restaurant`; relax `Reel` to require only `poster`.
- `src/lib/data.ts` — import the generated JSON instead of the mock array.
- `src/app/restaurant/[id]/page.tsx` — swap the static `distanceKm` line for `<UserDistance>`.

---

## Task 1: Tooling + env scaffolding

**Files:**
- Modify: `package.json`
- Create: `.gitignore` entry, `.env.example`

- [ ] **Step 1: Add devDependencies and scripts**

Run:
```bash
npm install --save-dev tsx@4.19.2 dotenv@16.4.5
```
Expected: both appear under `devDependencies` in `package.json`.

- [ ] **Step 2: Add npm scripts**

Edit `package.json` `scripts` to add these two lines (keep existing scripts):
```json
    "ingest": "tsx scripts/ingest.ts",
    "validate-data": "tsx scripts/validate-data.ts"
```

- [ ] **Step 3: Ignore the ingest cache**

Append to `.gitignore`:
```
# Ingest pipeline cache (regenerated on demand)
scripts/.ingest-cache/
```

- [ ] **Step 4: Document env vars**

Create `.env.example`:
```
# Server-side only. Used by scripts/ingest.ts and src/app/api/photo/route.ts.
# Never prefix with NEXT_PUBLIC_ — that would ship the key to the browser.
GOOGLE_PLACES_API_KEY=

# Optional. Enables Claude editorial copy at ingest and the live concierge.
# Without it, ingest falls back to deterministic editorial text.
ANTHROPIC_API_KEY=
```

- [ ] **Step 5: Verify**

Run: `npm run typecheck`
Expected: PASS (no source changes yet).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .gitignore .env.example
git commit -m "chore: add tsx/dotenv tooling and ingest env scaffolding"
```

---

## Task 2: Extend domain types (lat/lng + relaxed Reel)

**Files:**
- Modify: `src/lib/types.ts:43-78`

- [ ] **Step 1: Relax the Reel interface**

In `src/lib/types.ts`, replace the `Reel` interface (currently requires gradient/emoji/caption/author/likes) with one where only `poster` is required — real ingestion fills just the poster:
```ts
export interface Reel {
  id?: string;
  /** Optional looping mp4. If absent we render an animated photo poster. */
  video?: string;
  poster: string; // image url (or /api/photo?ref=... proxy url)
  /** Legacy fields — retained as optional, not rendered by the current UI. */
  gradient?: [string, string];
  emoji?: string;
  caption?: string;
  author?: string;
  likes?: number;
  dish?: string;
}
```

- [ ] **Step 2: Add lat/lng to Restaurant**

In the `Restaurant` interface, add two fields just after `city: string;`:
```ts
  city: string;
  /** Geocoordinates from Places — used for live, client-side distance. */
  lat: number;
  lng: number;
  distanceKm: number; // distance from the Chicago city-center reference point
```
Update the existing `distanceKm` doc comment as shown; do not remove `distanceKm` (it feeds the proximity nudge in `recommend.ts:150`).

- [ ] **Step 3: Verify the mock data still typechecks**

The existing `src/lib/data.ts` mock lacks `lat`/`lng`, so this will now fail — that is expected and is fixed in Task 11 when the mock is replaced. To keep the tree green until then, add placeholder coords to the mock is wasteful; instead make `lat`/`lng` temporarily tolerated by casting. Simplest: defer the typecheck gate to Task 11. Run only:

Run: `npx tsc --noEmit src/lib/types.ts 2>&1 | head -5` is not valid (project needs full program). Instead just confirm the edit compiles in isolation by eye; the full gate runs in Task 11.

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat(types): add lat/lng to Restaurant; relax Reel to require only poster"
```

> Note: between Task 2 and Task 11 the full `npm run build` will fail because the mock array lacks `lat`/`lng`. That window is intentional and closes in Task 11. Per-task builds inside that window are skipped where noted.

---

## Task 3: Neighborhood list + city center

**Files:**
- Create: `scripts/neighborhoods.ts`

- [ ] **Step 1: Write the module**

Create `scripts/neighborhoods.ts`:
```ts
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
```

- [ ] **Step 2: Verify**

Run: `npx tsx -e "import('./scripts/neighborhoods.ts').then(m => { if (m.NEIGHBORHOODS.length !== 9) throw new Error('expected 9'); console.log('ok', m.NEIGHBORHOODS.length); })"`
Expected: `ok 9`

- [ ] **Step 3: Commit**

```bash
git add scripts/neighborhoods.ts
git commit -m "feat(ingest): add Chicago neighborhood list and city-center reference"
```

---

## Task 4: Pure shared geo helper

**Files:**
- Create: `src/lib/geo.ts`

- [ ] **Step 1: Write haversineKm**

Create `src/lib/geo.ts`:
```ts
/** Great-circle distance in kilometers between two lat/lng points. */
export function haversineKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371; // km
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
```

- [ ] **Step 2: Verify (Chicago Loop → O'Hare ≈ 27 km)**

Run:
```bash
npx tsx -e "import('./src/lib/geo.ts').then(m => { const d = m.haversineKm(41.8786,-87.6251,41.9742,-87.9073); if (d < 24 || d > 30) throw new Error('bad: '+d); console.log('ok', d.toFixed(1)); })"
```
Expected: `ok` with a value around `26`–`27`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/geo.ts
git commit -m "feat: add pure haversineKm geo helper"
```

---

## Task 5: Derivation functions

**Files:**
- Create: `scripts/derive.ts`
- Test: `scripts/derive.check.ts`

- [ ] **Step 1: Write the failing check first**

Create `scripts/derive.check.ts`:
```ts
import assert from "node:assert/strict";
import {
  slugify,
  ratingFrom,
  priceFrom,
  cuisinesFromTypes,
  distanceFromCenterKm,
  buildBuzzNormalizer,
  percentileRank,
} from "./derive";

// slugify: stable, url-safe, suffixed with a placeId tail
assert.equal(slugify("Tony's Coal Oven!", "ChIJ_abc123XYZ"), "tonys-coal-oven-23xyz");

// ratingFrom: 0..5 -> 0..10, default 0
assert.equal(ratingFrom(4.7), 9.4);
assert.equal(ratingFrom(undefined), 0);

// priceFrom: Places enum -> 1..4, default 2
assert.equal(priceFrom("PRICE_LEVEL_INEXPENSIVE"), 1);
assert.equal(priceFrom("PRICE_LEVEL_VERY_EXPENSIVE"), 4);
assert.equal(priceFrom(undefined), 2);

// cuisinesFromTypes: maps fine-grained Places types -> Cuisine union
assert.deepEqual(cuisinesFromTypes(["ramen_restaurant", "restaurant"], "Ramen Koba"), ["Japanese"]);
assert.deepEqual(cuisinesFromTypes(["pizza_restaurant"], "Tony's"), ["Italian"]);
// name fallback when types are unhelpful
assert.deepEqual(cuisinesFromTypes(["restaurant"], "Pho 88"), ["Vietnamese"]);
// last-resort default
assert.deepEqual(cuisinesFromTypes(["restaurant"], "Corner Spot"), ["American"]);

// distanceFromCenterKm: ~0 at center
assert.ok(distanceFromCenterKm(41.8786, -87.6251) < 0.1);

// buzz: min-max over log(count); fewest reviews -> ~0, most -> ~1
const buzz = buildBuzzNormalizer([20, 200, 9000]);
assert.ok(buzz(20) < 0.01);
assert.ok(buzz(9000) > 0.99);
assert.ok(buzz(200) > 0 && buzz(200) < 1);

// percentileRank: 0..1, monotonic
const counts = [10, 50, 100, 5000];
assert.equal(percentileRank(counts, 10), 0);
assert.equal(percentileRank(counts, 5000), 1);

console.log("derive.check ok");
```

- [ ] **Step 2: Run the check to verify it fails**

Run: `npx tsx scripts/derive.check.ts`
Expected: FAIL — `Cannot find module './derive'`.

- [ ] **Step 3: Implement `scripts/derive.ts`**

Create `scripts/derive.ts`:
```ts
import { Cuisine, Price } from "../src/lib/types";
import { haversineKm } from "../src/lib/geo";
import { CHICAGO_CENTER } from "./neighborhoods";

export function slugify(name: string, placeId: string): string {
  const base = name
    .toLowerCase()
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
};

// Name keyword -> Cuisine, used when types are too generic.
const NAME_HINTS: [RegExp, Cuisine][] = [
  [/\b(pho|banh mi|vietnam)\b/i, "Vietnamese"],
  [/\b(taqueria|taco|cantina|mexican)\b/i, "Mexican"],
  [/\b(ramen|izakaya|sushi|udon)\b/i, "Japanese"],
  [/\b(trattoria|pizzeria|osteria|pasta)\b/i, "Italian"],
  [/\b(bbq|smokehouse|barbecue)\b/i, "BBQ"],
  [/\b(thai)\b/i, "Thai"],
  [/\b(curry|tandoor|masala)\b/i, "Indian"],
  [/\b(cafe|coffee|espresso)\b/i, "Cafe"],
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
```

- [ ] **Step 4: Run the check to verify it passes**

Run: `npx tsx scripts/derive.check.ts`
Expected: `derive.check ok`

- [ ] **Step 5: Commit**

```bash
git add scripts/derive.ts scripts/derive.check.ts
git commit -m "feat(ingest): add pure derivation helpers with assert checks"
```

---

## Task 6: Google Places client

**Files:**
- Create: `scripts/places.ts`
- Create: `scripts/fixtures/sample-places.json`

- [ ] **Step 1: Write the fixture (also used by Task 8 sample mode and Task 10 checks)**

Create `scripts/fixtures/sample-places.json`:
```json
[
  {
    "id": "ChIJsampleRAMENkoba00001",
    "displayName": { "text": "Ramen Koba" },
    "rating": 4.7,
    "userRatingCount": 180,
    "priceLevel": "PRICE_LEVEL_MODERATE",
    "types": ["ramen_restaurant", "restaurant"],
    "location": { "latitude": 41.929, "longitude": -87.7 },
    "formattedAddress": "2400 N California Ave, Chicago, IL",
    "businessStatus": "OPERATIONAL",
    "photos": [{ "name": "places/ChIJsampleRAMENkoba00001/photos/SAMPLEPHOTOREF1" }],
    "reviews": [
      { "text": { "text": "The black garlic tonkotsu is unreal. Go early, only 9 seats." } },
      { "text": { "text": "Off-menu mazemen if you ask. Best ramen in Avondale." } }
    ]
  },
  {
    "id": "ChIJsampleTAQUERIA0002",
    "displayName": { "text": "Taqueria El Milagro" },
    "rating": 4.5,
    "userRatingCount": 5200,
    "priceLevel": "PRICE_LEVEL_INEXPENSIVE",
    "types": ["mexican_restaurant", "restaurant"],
    "location": { "latitude": 41.857, "longitude": -87.655 },
    "formattedAddress": "1923 S Blue Island Ave, Chicago, IL",
    "businessStatus": "OPERATIONAL",
    "photos": [{ "name": "places/ChIJsampleTAQUERIA0002/photos/SAMPLEPHOTOREF2" }],
    "reviews": [
      { "text": { "text": "Tortillas made on site. The al pastor tacos are a Pilsen institution." } }
    ]
  }
]
```

- [ ] **Step 2: Implement the client**

Create `scripts/places.ts`:
```ts
export interface PlacePhoto {
  name: string; // e.g. "places/PLACE_ID/photos/PHOTO_REF"
}
export interface PlaceReview {
  text?: { text: string };
}
export interface RawPlace {
  id: string;
  displayName?: { text: string };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  types?: string[];
  location?: { latitude: number; longitude: number };
  formattedAddress?: string;
  businessStatus?: string;
  photos?: PlacePhoto[];
  reviews?: PlaceReview[];
  editorialSummary?: { text: string };
  websiteUri?: string;
}

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.types",
  "places.location",
  "places.formattedAddress",
  "places.businessStatus",
  "places.photos",
  "places.reviews",
  "places.editorialSummary",
  "places.websiteUri",
  "nextPageToken",
].join(",");

/** Text Search (Places API New). Pages until maxResults or no nextPageToken. */
export async function searchText(
  query: string,
  apiKey: string,
  maxResults = 40,
): Promise<RawPlace[]> {
  const out: RawPlace[] = [];
  let pageToken: string | undefined;
  do {
    const body: Record<string, unknown> = { textQuery: query, pageSize: 20 };
    if (pageToken) body.pageToken = pageToken;
    const res = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": FIELD_MASK,
        },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) {
      throw new Error(`places searchText ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as {
      places?: RawPlace[];
      nextPageToken?: string;
    };
    out.push(...(data.places ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken && out.length < maxResults);
  return out.slice(0, maxResults);
}

/** Server-side photo media URL. The key stays server-side (proxy route only). */
export function photoMediaUrl(
  photoName: string,
  apiKey: string,
  maxWidthPx = 900,
): string {
  return `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidthPx}&key=${apiKey}`;
}
```

- [ ] **Step 3: Verify it typechecks and the fixture parses**

Run:
```bash
npx tsx -e "import fs from 'fs'; import('./scripts/places.ts').then(() => { const p = JSON.parse(fs.readFileSync('scripts/fixtures/sample-places.json','utf8')); if (!Array.isArray(p) || p.length !== 2) throw new Error('fixture'); console.log('ok', p.length); })"
```
Expected: `ok 2`

- [ ] **Step 4: (Optional) live smoke — only if a key is set**

Run:
```bash
[ -n "$GOOGLE_PLACES_API_KEY" ] && npx tsx -e "import('dotenv/config').then(()=>import('./scripts/places.ts')).then(async m => { const r = await m.searchText('restaurants in Pilsen, Chicago', process.env.GOOGLE_PLACES_API_KEY, 5); console.log('got', r.length, r[0]?.displayName?.text); })" || echo "no key — skipping live smoke"
```
Expected: either `got 5 <name>` or `no key — skipping live smoke`.

- [ ] **Step 5: Commit**

```bash
git add scripts/places.ts scripts/fixtures/sample-places.json
git commit -m "feat(ingest): add Google Places (New) text-search client + fixture"
```

---

## Task 7: Editorial generation (Claude Haiku + fallback)

**Files:**
- Create: `scripts/editorial.ts`
- Test: `scripts/editorial.check.ts`

- [ ] **Step 1: Write the failing check (exercises the no-key fallback only — deterministic)**

Create `scripts/editorial.check.ts`:
```ts
import assert from "node:assert/strict";
import { generateEditorial } from "./editorial";

const run = async () => {
  const ed = await generateEditorial(
    {
      name: "Ramen Koba",
      cuisines: ["Japanese"],
      price: 2,
      rating: 9.4,
      reviewCount: 180,
      reviewSnippets: ["Best ramen in Avondale.", "Only 9 seats, go early."],
    },
    undefined, // no API key -> deterministic fallback
  );
  assert.ok(ed.blurb.length > 0, "blurb non-empty");
  assert.ok(ed.insiderTip.length > 0, "insiderTip non-empty");
  assert.ok(Array.isArray(ed.signatureDishes));
  assert.ok(ed.spice >= 0 && ed.spice <= 3, "spice in 0..3");
  // vibes constrained to the Vibe union
  for (const v of ed.vibes) {
    assert.ok(
      ["trendy", "cozy", "casual", "fine-dining", "late-night", "date-night", "group-friendly", "outdoor", "quick-bite", "hidden-gem"].includes(v),
      "vibe in union: " + v,
    );
  }
  console.log("editorial.check ok");
};
run();
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx scripts/editorial.check.ts`
Expected: FAIL — `Cannot find module './editorial'`.

- [ ] **Step 3: Implement `scripts/editorial.ts`**

Create `scripts/editorial.ts` (mirrors the raw-`fetch` Anthropic pattern in `src/app/api/assistant/route.ts`; uses `claude-haiku-4-5`):
```ts
import { Cuisine, Dietary, Price, Vibe } from "../src/lib/types";

export interface EditorialInput {
  name: string;
  cuisines: Cuisine[];
  price: Price;
  rating: number;
  reviewCount: number;
  reviewSnippets: string[];
}

export interface Editorial {
  blurb: string;
  insiderTip: string;
  signatureDishes: string[];
  vibes: Vibe[];
  tags: string[];
  dietary: Dietary[];
  spice: number;
}

const VIBES: Vibe[] = [
  "trendy", "cozy", "casual", "fine-dining", "late-night",
  "date-night", "group-friendly", "outdoor", "quick-bite", "hidden-gem",
];
const DIETARY: Dietary[] = ["vegetarian", "vegan", "gluten-free", "halal", "dairy-free"];

const priceStr = (p: Price) => "$".repeat(p);

/** Deterministic, no-LLM editorial — also the fallback when no key is present. */
function fallbackEditorial(input: EditorialInput): Editorial {
  const vibes: Vibe[] = [];
  if (input.price >= 4) vibes.push("fine-dining", "date-night");
  else if (input.cuisines.includes("Cafe")) vibes.push("casual", "quick-bite");
  else vibes.push("casual", "cozy");
  const spice = input.cuisines.some((c) =>
    ["Thai", "Indian", "Korean", "Mexican"].includes(c),
  )
    ? 2
    : 0;
  return {
    blurb: `A ${input.cuisines.join(" / ")} spot in the neighborhood — ${priceStr(
      input.price,
    )}, rated ${input.rating.toFixed(1)} by locals.`,
    insiderTip: "Go on a weekday — quieter, and the kitchen has more time for you.",
    signatureDishes: [],
    vibes,
    tags: input.cuisines.map((c) => c.toLowerCase()),
    dietary: [],
    spice,
  };
}

function extractJson(text: string): any | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function coerce(raw: any, input: EditorialInput): Editorial {
  const fb = fallbackEditorial(input);
  if (!raw || typeof raw !== "object") return fb;
  const vibes = Array.isArray(raw.vibes)
    ? (raw.vibes.filter((v: any) => VIBES.includes(v)) as Vibe[]).slice(0, 3)
    : fb.vibes;
  const dietary = Array.isArray(raw.dietary)
    ? (raw.dietary.filter((d: any) => DIETARY.includes(d)) as Dietary[])
    : [];
  const spiceNum = Number(raw.spice);
  const spice = Number.isFinite(spiceNum) ? Math.max(0, Math.min(3, Math.round(spiceNum))) : fb.spice;
  return {
    blurb: typeof raw.blurb === "string" && raw.blurb.trim() ? raw.blurb.trim() : fb.blurb,
    insiderTip:
      typeof raw.insiderTip === "string" && raw.insiderTip.trim()
        ? raw.insiderTip.trim()
        : fb.insiderTip,
    signatureDishes: Array.isArray(raw.signatureDishes)
      ? raw.signatureDishes.filter((s: any) => typeof s === "string").slice(0, 4)
      : [],
    vibes: vibes.length ? vibes : fb.vibes,
    tags: Array.isArray(raw.tags)
      ? raw.tags.filter((s: any) => typeof s === "string").slice(0, 5)
      : fb.tags,
    dietary,
    spice,
  };
}

export async function generateEditorial(
  input: EditorialInput,
  apiKey?: string,
): Promise<Editorial> {
  if (!apiKey) return fallbackEditorial(input);
  const model = process.env.ANTHROPIC_INGEST_MODEL || "claude-haiku-4-5";
  const system =
    "You write Truffle's calm, in-the-know restaurant copy. Use ONLY the supplied facts and review snippets — never invent awards, prices, or claims. " +
    'Respond with STRICT JSON only: {"blurb": string (1 warm sentence), "insiderTip": string (1 specific how-to-order/when-to-go tip grounded in the reviews), ' +
    '"signatureDishes": string[] (0-4, only dishes named in the reviews), ' +
    `"vibes": string[] (0-3 from ${JSON.stringify(VIBES)}), ` +
    `"dietary": string[] (0-3 from ${JSON.stringify(DIETARY)}), ` +
    '"tags": string[] (0-5 short descriptors), "spice": number (0-3 typical heat). No prose outside JSON.';
  const userMsg =
    `Name: ${input.name}\n` +
    `Cuisines: ${input.cuisines.join(", ")}\n` +
    `Price: ${priceStr(input.price)}\n` +
    `Rating (0-10): ${input.rating}\n` +
    `Review count: ${input.reviewCount}\n` +
    `Review snippets:\n- ${input.reviewSnippets.slice(0, 5).join("\n- ")}`;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 500,
        system,
        messages: [{ role: "user", content: userMsg }],
      }),
    });
    if (!res.ok) throw new Error(`anthropic ${res.status}`);
    const data = await res.json();
    const text: string = data?.content?.map((b: any) => b.text).join("") ?? "";
    return coerce(extractJson(text), input);
  } catch (e) {
    console.error(`editorial fallback for "${input.name}":`, (e as Error).message);
    return fallbackEditorial(input);
  }
}
```

- [ ] **Step 4: Run the check to verify it passes**

Run: `npx tsx scripts/editorial.check.ts`
Expected: `editorial.check ok`

- [ ] **Step 5: Commit**

```bash
git add scripts/editorial.ts scripts/editorial.check.ts
git commit -m "feat(ingest): add Claude Haiku editorial generation with deterministic fallback"
```

---

## Task 8: placeId file cache

**Files:**
- Create: `scripts/cache.ts`

- [ ] **Step 1: Implement**

Create `scripts/cache.ts`:
```ts
import fs from "fs";
import path from "path";

const DIR = path.join(process.cwd(), "scripts", ".ingest-cache");

function pathFor(placeId: string): string {
  const safe = placeId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(DIR, `${safe}.json`);
}

export function readCache<T = unknown>(placeId: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(pathFor(placeId), "utf8")) as T;
  } catch {
    return null;
  }
}

export function writeCache(placeId: string, data: unknown): void {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(pathFor(placeId), JSON.stringify(data), "utf8");
}
```

- [ ] **Step 2: Verify round-trip**

Run:
```bash
npx tsx -e "import('./scripts/cache.ts').then(m => { m.writeCache('ChIJ test/1', {a:1}); const r = m.readCache('ChIJ test/1'); if (!r || r.a !== 1) throw new Error('roundtrip'); console.log('ok'); })" && rm -rf scripts/.ingest-cache
```
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add scripts/cache.ts
git commit -m "feat(ingest): add placeId-keyed file cache"
```

---

## Task 9: Ingest orchestrator

**Files:**
- Create: `scripts/ingest.ts`

- [ ] **Step 1: Implement the orchestrator**

Create `scripts/ingest.ts`:
```ts
import "dotenv/config";
import fs from "fs";
import path from "path";
import { Restaurant } from "../src/lib/types";
import { NEIGHBORHOODS } from "./neighborhoods";
import { RawPlace, searchText } from "./places";
import {
  buildBuzzNormalizer,
  cuisinesFromTypes,
  distanceFromCenterKm,
  percentileRank,
  priceFrom,
  ratingFrom,
  slugify,
} from "./derive";
import { generateEditorial } from "./editorial";
import { readCache, writeCache } from "./cache";

const OUT = path.join(process.cwd(), "src", "lib", "restaurants.generated.json");
const PER_NEIGHBORHOOD = 50;
const MIN_REVIEWS = 10;
const FOOD_TYPES = new Set([
  "restaurant", "cafe", "coffee_shop", "bakery", "bar",
  "meal_takeaway", "meal_delivery", "ice_cream_shop", "dessert_shop",
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
      console.log(`Searching ${n.name}...`);
      const places = await searchText(n.query, apiKey, PER_NEIGHBORHOOD);
      for (const place of places) raw.push({ place, neighborhood: n.name });
    }
  }

  // 2. Filter + dedupe by placeId.
  const seen = new Set<string>();
  const kept = raw.filter(({ place }) => {
    if (!place.id || seen.has(place.id)) return false;
    if (place.businessStatus && place.businessStatus !== "OPERATIONAL") return false;
    if (!isFood(place)) return false;
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
    const cuisines = cuisinesFromTypes(place.types, name);
    const price = priceFrom(place.priceLevel);
    const rating = ratingFrom(place.rating);
    const reviewCount = place.userRatingCount ?? 0;
    const lat = place.location!.latitude;
    const lng = place.location!.longitude;

    let editorial = readCache<any>(place.id)?.editorial;
    if (!editorial) {
      editorial = await generateEditorial(
        { name, cuisines, price, rating, reviewCount, reviewSnippets: reviewSnippets(place) },
        anthropicKey,
      );
      writeCache(place.id, { editorial });
    }

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
      blurb: editorial.blurb,
      reels: [{ poster }],
    });
  }

  restaurants.sort((a, b) => b.rating * (1 - b.buzz) - a.rating * (1 - a.buzz));
  fs.writeFileSync(OUT, JSON.stringify(restaurants, null, 2) + "\n", "utf8");
  console.log(`Wrote ${restaurants.length} restaurants to ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Verify it runs in sample mode (no keys needed)**

Run: `npm run ingest -- --sample`
Expected: prints `Kept 2 of 2 places.` and `Wrote 2 restaurants to .../restaurants.generated.json`. The file now exists.

- [ ] **Step 3: Sanity-check the generated sample**

Run:
```bash
npx tsx -e "import fs from 'fs'; const r = JSON.parse(fs.readFileSync('src/lib/restaurants.generated.json','utf8')); const koba = r.find(x => x.name === 'Ramen Koba'); const taq = r.find(x => x.name.includes('Milagro')); if (!(koba.buzz < taq.buzz)) throw new Error('gem ordering wrong'); console.log('ok: koba buzz', koba.buzz, '< taqueria buzz', taq.buzz);"
```
Expected: `ok: koba buzz 0 < taqueria buzz 1` (low-review Koba is the bigger gem).

- [ ] **Step 4: Commit (script only — real data lands in Task 12)**

```bash
git add scripts/ingest.ts
git commit -m "feat(ingest): add orchestrator that writes restaurants.generated.json"
```

---

## Task 10: Data validator

**Files:**
- Create: `scripts/validate-data.ts`

- [ ] **Step 1: Implement**

Create `scripts/validate-data.ts`:
```ts
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { Restaurant } from "../src/lib/types";

const file = path.join(process.cwd(), "src", "lib", "restaurants.generated.json");
const data = JSON.parse(fs.readFileSync(file, "utf8")) as Restaurant[];

assert.ok(Array.isArray(data) && data.length > 0, "non-empty array");

const ids = new Set<string>();
for (const r of data) {
  assert.ok(r.id && !ids.has(r.id), `unique id: ${r.id}`);
  ids.add(r.id);
  assert.ok(r.name, `name on ${r.id}`);
  assert.ok(r.cuisines.length > 0, `cuisines on ${r.id}`);
  assert.ok(r.rating >= 0 && r.rating <= 10, `rating range on ${r.id}`);
  assert.ok(r.buzz >= 0 && r.buzz <= 1, `buzz range on ${r.id}`);
  assert.ok(r.popularity >= 0 && r.popularity <= 1, `popularity range on ${r.id}`);
  assert.ok([1, 2, 3, 4].includes(r.price), `price enum on ${r.id}`);
  assert.ok(Number.isFinite(r.lat) && Number.isFinite(r.lng), `coords on ${r.id}`);
  assert.ok(Number.isFinite(r.distanceKm), `distanceKm on ${r.id}`);
  assert.ok(r.city === "Chicago", `city on ${r.id}`);
  assert.ok(r.reels[0]?.poster !== undefined, `poster on ${r.id}`);
  assert.ok(r.blurb && r.insiderTip, `editorial on ${r.id}`);
}

const neighborhoods = new Set(data.map((r) => r.neighborhood));
console.log(
  `validate-data ok: ${data.length} restaurants across ${neighborhoods.size} neighborhoods`,
);
```

- [ ] **Step 2: Verify against the sample data**

Run: `npm run validate-data`
Expected: `validate-data ok: 2 restaurants across 2 neighborhoods`

- [ ] **Step 3: Commit**

```bash
git add scripts/validate-data.ts
git commit -m "feat(ingest): add generated-data invariant validator"
```

---

## Task 11: Switch data.ts to the generated JSON

**Files:**
- Modify: `src/lib/data.ts`
- Modify: `tsconfig.json` (only if `resolveJsonModule` is absent)

- [ ] **Step 1: Confirm resolveJsonModule is enabled**

Run: `grep -q '"resolveJsonModule": true' tsconfig.json && echo present || echo missing`
If `missing`, add `"resolveJsonModule": true,` inside `compilerOptions` in `tsconfig.json`. (Next's default template usually has it.)

- [ ] **Step 2: Replace the mock array**

Replace the entire contents of `src/lib/data.ts` with:
```ts
import { Restaurant } from "./types";
import generated from "./restaurants.generated.json";

/**
 * Real Chicago restaurant dataset, generated by `npm run ingest` from the
 * Google Places API (see scripts/ingest.ts). Regenerate + commit to refresh.
 * The cast is required because JSON widens string-literal unions to `string`.
 */
export const RESTAURANTS = generated as unknown as Restaurant[];
```

- [ ] **Step 3: Verify the full gate now passes (sample data is in place from Task 9)**

Run: `npm run typecheck && npm run build`
Expected: PASS. (The mock array is gone; `lat`/`lng` from Task 2 are now satisfied by the generated data.)

- [ ] **Step 4: Grep for stragglers referencing removed mock internals**

Run: `grep -rn "img(" src/lib/data.ts; grep -rn "gradient:" src/components src/app || echo "no gradient refs"`
Expected: no matches in `data.ts`; `no gradient refs` (the UI never reads gradient).

- [ ] **Step 5: Commit**

```bash
git add src/lib/data.ts tsconfig.json src/lib/restaurants.generated.json
git commit -m "feat: source RESTAURANTS from generated JSON instead of mock array"
```

---

## Task 12: Photo proxy route

**Files:**
- Create: `src/app/api/photo/route.ts`

- [ ] **Step 1: Implement the proxy**

Create `src/app/api/photo/route.ts`:
```ts
import { NextRequest } from "next/server";
import { photoMediaUrl } from "../../../../scripts/places";

export const runtime = "nodejs";

/**
 * Proxies a Google Places photo so the API key stays server-side.
 * GET /api/photo?ref=places/PLACE_ID/photos/PHOTO_REF
 */
export async function GET(req: NextRequest) {
  const ref = req.nextUrl.searchParams.get("ref") ?? "";
  if (!ref.startsWith("places/") || !ref.includes("/photos/")) {
    return new Response("bad ref", { status: 400 });
  }
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return new Response("not configured", { status: 503 });

  const upstream = await fetch(photoMediaUrl(ref, apiKey, 900), {
    redirect: "follow",
  });
  if (!upstream.ok || !upstream.body) {
    return new Response("upstream error", { status: 502 });
  }
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "image/jpeg",
      // Hero photos rarely change — cache hard to bound Places Photo cost.
      "cache-control": "public, max-age=604800, immutable",
    },
  });
}
```

> Note: importing `photoMediaUrl` from `scripts/places.ts` keeps the URL shape in one place. If the build complains about importing outside `src/`, copy the 3-line `photoMediaUrl` into the route instead — it has no other dependencies.

- [ ] **Step 2: Verify typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: PASS. If the cross-dir import errors, apply the inline-copy fallback from the note, then re-run.

- [ ] **Step 3: Live smoke (only if a key is set)** — confirm the route streams an image and the key never reaches the client

Run:
```bash
[ -n "$GOOGLE_PLACES_API_KEY" ] && { npm run build >/dev/null 2>&1 && (npm run start >/tmp/truffle-start.log 2>&1 &) && sleep 4 && curl -s -o /dev/null -w "photo route: HTTP %{http_code} %{content_type}\n" "http://localhost:3000/api/photo?ref=$(node -e "console.log(encodeURIComponent('places/INVALID/photos/X'))")" ; lsof -ti:3000 | xargs kill -9 2>/dev/null; } || echo "no key — skipping live photo smoke"
```
Expected: either an HTTP status line (400/502 for the invalid ref is acceptable — it proves the route runs) or `no key — skipping live photo smoke`. Also confirm no key leak:
```bash
grep -rn "GOOGLE_PLACES_API_KEY" .next/static 2>/dev/null && echo "LEAK!" || echo "no key in client bundle"
```
Expected: `no key in client bundle`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/photo/route.ts
git commit -m "feat: add server-side Google Places photo proxy route"
```

---

## Task 13: Live distance on the detail page

**Files:**
- Create: `src/components/UserDistance.tsx`
- Modify: `src/app/restaurant/[id]/page.tsx:92`

- [ ] **Step 1: Build the client distance component**

Create `src/components/UserDistance.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { haversineKm } from "@/lib/geo";

/**
 * Shows live "X km away" when the user grants geolocation; otherwise renders
 * nothing (the caller already shows the neighborhood). No prompt is forced —
 * we only read a position the browser will give us.
 */
export default function UserDistance({ lat, lng }: { lat: number; lng: number }) {
  const [km, setKm] = useState<number | null>(null);

  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setKm(haversineKm(pos.coords.latitude, pos.coords.longitude, lat, lng)),
      () => setKm(null),
      { maximumAge: 300000, timeout: 5000 },
    );
  }, [lat, lng]);

  if (km === null) return null;
  return <span> · {km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`} away</span>;
}
```

- [ ] **Step 2: Wire it into the detail page**

In `src/app/restaurant/[id]/page.tsx`, find line 92:
```tsx
            {r.neighborhood}, {r.city} · {r.distanceKm} km away
```
Replace it with:
```tsx
            {r.neighborhood}, {r.city}
            <UserDistance lat={r.lat} lng={r.lng} />
```
Add the import near the other component imports at the top of the file:
```tsx
import UserDistance from "@/components/UserDistance";
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm run build`
Expected: PASS.

Run: `grep -rn "distanceKm" src/app src/components || echo "no static distanceKm in UI"`
Expected: `no static distanceKm in UI` (it now lives only in data + `recommend.ts`).

- [ ] **Step 4: Commit**

```bash
git add src/components/UserDistance.tsx "src/app/restaurant/[id]/page.tsx"
git commit -m "feat: show live geolocation distance on the detail page, neighborhood fallback"
```

---

## Task 14: Live ingest run + commit the real dataset

> Requires `GOOGLE_PLACES_API_KEY` (and ideally `ANTHROPIC_API_KEY`) in `.env`. This replaces the 2-record sample with the real Chicago dataset.

**Files:**
- Modify (regenerate): `src/lib/restaurants.generated.json`

- [ ] **Step 1: Confirm the key is present**

Run: `grep -q "GOOGLE_PLACES_API_KEY=." .env && echo "key present" || echo "ADD GOOGLE_PLACES_API_KEY to .env first"`
Expected: `key present`. If not, stop and add it.

- [ ] **Step 2: Run the real ingest**

Run: `npm run ingest`
Expected: per-neighborhood `Searching …` lines, then `Kept N of M places.` and `Wrote N restaurants …` (expect N in the ~300–500 range).

- [ ] **Step 3: Validate the real data**

Run: `npm run validate-data`
Expected: `validate-data ok: N restaurants across 9 neighborhoods` (all 9 represented; if a neighborhood is missing, note it and consider raising `PER_NEIGHBORHOOD` or adjusting that neighborhood's query).

- [ ] **Step 4: Eyeball the gem ranking**

Run:
```bash
npx tsx -e "import fs from 'fs'; const r = JSON.parse(fs.readFileSync('src/lib/restaurants.generated.json','utf8')); const gem = r.map(x => ({n:x.name, gem:+(x.rating*(1-x.buzz)).toFixed(2), revBuzz:x.buzz})).slice(0,8); console.table(gem);"
```
Expected: top entries are high-rating, low-buzz spots (the hidden gems) — not the most-reviewed tourist names.

- [ ] **Step 5: Full gate + commit the dataset**

Run: `npm run typecheck && npm run build`
Expected: PASS.

```bash
git add src/lib/restaurants.generated.json
git commit -m "data: ingest real Chicago restaurant dataset (9 neighborhoods)"
```

---

## Task 15: Final verification sweep

- [ ] **Step 1: Full correctness gate**

Run: `npm run typecheck && npm run build && npm run validate-data`
Expected: all PASS.

- [ ] **Step 2: Design-system + safety greps**

Run:
```bash
grep -rn "NEXT_PUBLIC_GOOGLE" src && echo "LEAK!" || echo "no public google key"
grep -rn "images.unsplash.com" src/lib/restaurants.generated.json && echo "still using unsplash" || echo "real photos via proxy"
grep -rnE "#[0-9a-fA-F]{6}" src/components src/app | grep -v "geo.ts" || echo "no raw hex in components"
```
Expected: `no public google key`; `real photos via proxy`; `no raw hex in components`.

- [ ] **Step 3: Manual visual pass (deferred QA, per the prior session)**

Run `npm run dev`, then load feed / a detail page / search at a 375px viewport. Confirm real names, real photos (via `/api/photo`), sensible gem scores, and that the detail page shows the neighborhood (plus a live distance if you allow geolocation).

- [ ] **Step 4: No commit needed unless greps surfaced fixes.**

---

## Self-review notes (author)

- **Spec coverage:** sourcing via Places (Tasks 6, 14) · buzz from review count (Task 5 `buildBuzzNormalizer`, applied in Task 9) · Claude editorial (Task 7) · photo proxy (Task 12) · build-time JSON import (Task 11) · dynamic distance + lat/lng (Tasks 2, 4, 13) · 9 neighborhoods incl. Lakeview (Task 3) · cache (Task 8) · validation (Task 10) · YAGNI: no DB/auth, recommender untouched. All covered.
- **recommender unchanged:** `distanceKm` stays required and is populated from the city center (Task 9), so `recommend.ts:150` is never touched and never sees `NaN`.
- **Green-build window:** Tasks 2–10 don't break the app build except the documented Task 2→11 window; Task 9 `--sample` produces a valid JSON before Task 11 flips `data.ts`, so Task 11's gate passes without a live key.
- **Type consistency:** `Editorial`, `RawPlace`, `Neighborhood`, `EditorialInput` field names are used identically across `editorial.ts`, `places.ts`, `ingest.ts`.
