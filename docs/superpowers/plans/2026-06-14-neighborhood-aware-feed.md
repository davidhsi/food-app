# Neighborhood-aware Feed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a neighborhood chip-row to the feed that soft-steers `recommend()` toward a chosen Chicago area (with a gentle falloff to nearby areas) and auto-detects the nearest neighborhood on first visit.

**Architecture:** A new pure `src/lib/neighborhoods.ts` derives per-neighborhood centroids from the dataset and finds the nearest one to a point. `recommend.ts` gains an optional `neighborhood` signal (exact-match boost + centroid-distance falloff, never negative). The persisted Zustand store holds the selection; a new `NeighborhoodChips` client component renders the row and runs one-shot geolocation auto-detect. The feed page wires it together.

**Tech Stack:** Next.js 14 App Router, TypeScript (strict), Tailwind (semantic tokens), Zustand. **No test framework** (by design — see CLAUDE.md). Verification = `npm run typecheck && npm run build`, `npx tsx scripts/*.check.ts` `node:assert` probes for pure logic, and a manual 375px visual pass.

---

## File Structure

- **Create `src/lib/neighborhoods.ts`** — pure: centroids, `NEIGHBORHOODS`, `neighborhoodCentroid`, `nearestNeighborhood`.
- **Create `scripts/neighborhoods.check.ts`** — `node:assert` probe for the centroid/nearest logic (un-wired, matches existing `scripts/*.check.ts`).
- **Modify `src/lib/store.ts`** — add `neighborhood`, `neighborhoodTouched`, `setNeighborhood`; update `reset`.
- **Modify `src/lib/recommend.ts`** — add `neighborhood?` to `SignalState`; add the soft-steer scoring block.
- **Create `scripts/recommend-neighborhood.check.ts`** — `node:assert` probe for the scoring behavior.
- **Create `src/components/NeighborhoodChips.tsx`** — client: chip row + one-shot auto-detect.
- **Modify `src/app/feed/page.tsx`** — render the chips, pass `neighborhood` into `recommend()`, swap the subtitle.

---

## Task 1: Neighborhood centroids library

**Files:**
- Create: `src/lib/neighborhoods.ts`
- Test: `scripts/neighborhoods.check.ts`

- [ ] **Step 1: Create `src/lib/neighborhoods.ts`**

```ts
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
  for (const [name, c] of acc)
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
```

- [ ] **Step 2: Write the assert probe `scripts/neighborhoods.check.ts`**

```ts
import assert from "node:assert";
import {
  NEIGHBORHOODS,
  nearestNeighborhood,
  neighborhoodCentroid,
} from "../src/lib/neighborhoods";

// 9 neighborhoods, in sorted order.
assert.strictEqual(NEIGHBORHOODS.length, 9, "expected 9 neighborhoods");
assert.deepStrictEqual(
  [...NEIGHBORHOODS].sort(),
  NEIGHBORHOODS,
  "NEIGHBORHOODS should be sorted",
);

// Every neighborhood has a plausible Chicago centroid.
for (const n of NEIGHBORHOODS) {
  const c = neighborhoodCentroid(n);
  assert.ok(c, `centroid exists for ${n}`);
  assert.ok(c!.lat > 41 && c!.lat < 42, `lat plausible for ${n}`);
  assert.ok(c!.lng > -88 && c!.lng < -87, `lng plausible for ${n}`);
}

// nearestNeighborhood maps a centroid back to its own neighborhood.
for (const n of NEIGHBORHOODS) {
  const c = neighborhoodCentroid(n)!;
  assert.strictEqual(
    nearestNeighborhood(c.lat, c.lng),
    n,
    `nearest to ${n}'s centroid is ${n}`,
  );
}

console.log("neighborhoods.check.ts: OK");
```

- [ ] **Step 3: Run the probe — expect it to pass**

Run: `npx tsx scripts/neighborhoods.check.ts`
Expected: prints `neighborhoods.check.ts: OK`, exit 0.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/neighborhoods.ts scripts/neighborhoods.check.ts
git commit -m "feat(lib): derive neighborhood centroids + nearest lookup"
```

---

## Task 2: Store the selected neighborhood

**Files:**
- Modify: `src/lib/store.ts`

- [ ] **Step 1: Add the fields to the `AppState` interface**

In `src/lib/store.ts`, inside `interface AppState`, add after `seen: string[];`:

```ts
  neighborhood: string | null; // null = "Anywhere" (no steer)
  neighborhoodTouched: boolean; // true once the user has chosen, incl. "Anywhere"
```

And add the action signature after `markSeen: (id: string) => void;`:

```ts
  setNeighborhood: (name: string | null) => void;
```

- [ ] **Step 2: Add the initial values**

In the `create(...)` initializer object, after `seen: [],` add:

```ts
      neighborhood: null,
      neighborhoodTouched: false,
```

- [ ] **Step 3: Add the action**

After the `markSeen` action block, add:

```ts
      setNeighborhood: (name) =>
        set({ neighborhood: name, neighborhoodTouched: true }),
```

- [ ] **Step 4: Update `reset()`**

In the `reset` action's `set({ ... })`, add after `seen: [],`:

```ts
          neighborhood: null,
          neighborhoodTouched: false,
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/store.ts
git commit -m "feat(store): persist selected neighborhood + touched flag"
```

---

## Task 3: Soft-steer scoring signal

**Files:**
- Modify: `src/lib/recommend.ts`
- Test: `scripts/recommend-neighborhood.check.ts`

- [ ] **Step 1: Add imports**

At the top of `src/lib/recommend.ts`, after the existing `./types` import, add:

```ts
import { haversineKm } from "./geo";
import { neighborhoodCentroid } from "./neighborhoods";
```

- [ ] **Step 2: Extend `SignalState`**

In `interface SignalState`, add after `seen?: string[];`:

```ts
  neighborhood?: string | null; // soft-steer the feed toward this area
```

- [ ] **Step 3: Add the scoring block**

In `scoreRestaurant`, immediately after the `// 9. Proximity nudge` block
(`score += clamp(1 - r.distanceKm / 10) * 5;`) and before `// 10. Novelty / already-seen damping`, insert:

```ts
  // 9b. Neighborhood soft steer — lift the chosen area, and gently its
  // neighbors, without filtering anything out. Exact match earns an
  // explainable reason; a centroid-distance falloff keeps it a steer, not a
  // wall. Never negative, so the feed never empties.
  if (state.neighborhood) {
    if (r.neighborhood === state.neighborhood) {
      score += 18;
      reasons.push({ label: `In ${state.neighborhood}`, weight: 18 });
    }
    const centroid = neighborhoodCentroid(state.neighborhood);
    if (centroid) {
      const km = haversineKm(centroid.lat, centroid.lng, r.lat, r.lng);
      score += clamp(1 - km / 6) * 10;
    }
  }
```

- [ ] **Step 4: Write the assert probe `scripts/recommend-neighborhood.check.ts`**

```ts
import assert from "node:assert";
import { RESTAURANTS } from "../src/lib/data";
import { scoreRestaurant, type SignalState } from "../src/lib/recommend";

const base: SignalState = {
  profile: {
    cuisines: [],
    price: [1, 2, 3],
    vibes: [],
    dietary: [],
    spiceTolerance: 1,
    adventurousness: 0.5,
    undergroundBias: 0.7,
  },
  liked: [],
  saved: [],
  ranked: [],
};

const r = RESTAURANTS[0];

// Selecting a spot's own neighborhood raises its score and adds an "In X" reason.
const without = scoreRestaurant(r, base);
const withHood = scoreRestaurant(r, { ...base, neighborhood: r.neighborhood });
assert.ok(
  withHood.precise > without.precise,
  "own-neighborhood selection should raise the score",
);
assert.ok(
  withHood.reasons.some((x) => x.label === `In ${r.neighborhood}`),
  "exact match should add an 'In <neighborhood>' reason",
);

// A spot in a different neighborhood gets no "In ..." reason (not an exact match).
const other = RESTAURANTS.find((x) => x.neighborhood !== r.neighborhood)!;
const otherScored = scoreRestaurant(other, {
  ...base,
  neighborhood: r.neighborhood,
});
assert.ok(
  !otherScored.reasons.some((x) => x.label.startsWith("In ")),
  "non-matching spot should not get an In-reason",
);

// The steer never drops a score below its un-steered value (never negative).
assert.ok(
  otherScored.precise >= scoreRestaurant(other, base).precise - 1e-9,
  "soft steer is never negative",
);

console.log("recommend-neighborhood.check.ts: OK");
```

- [ ] **Step 5: Run the probe — expect it to pass**

Run: `npx tsx scripts/recommend-neighborhood.check.ts`
Expected: prints `recommend-neighborhood.check.ts: OK`, exit 0.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/recommend.ts scripts/recommend-neighborhood.check.ts
git commit -m "feat(recommend): neighborhood soft-steer signal with falloff"
```

---

## Task 4: Neighborhood chip row + auto-detect

**Files:**
- Create: `src/components/NeighborhoodChips.tsx`

- [ ] **Step 1: Create `src/components/NeighborhoodChips.tsx`**

```tsx
"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { NEIGHBORHOODS, nearestNeighborhood } from "@/lib/neighborhoods";

/**
 * Feed neighborhood selector. Renders "Anywhere" + the 9 areas as a scrollable
 * chip row and soft-steers the feed via the store. On first visit only (while
 * untouched), it runs one fail-silent geolocation read and pre-selects the
 * nearest neighborhood — mirroring the UserDistance pattern.
 */
export default function NeighborhoodChips() {
  const neighborhood = useStore((s) => s.neighborhood);
  const touched = useStore((s) => s.neighborhoodTouched);
  const setNeighborhood = useStore((s) => s.setNeighborhood);

  useEffect(() => {
    if (touched) return;
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Bail if the user tapped a chip during the permission prompt.
        if (useStore.getState().neighborhoodTouched) return;
        setNeighborhood(
          nearestNeighborhood(pos.coords.latitude, pos.coords.longitude),
        );
      },
      () => {},
      { maximumAge: 300000, timeout: 5000 },
    );
  }, [touched, setNeighborhood]);

  const chip = (label: string, active: boolean, onClick: () => void) => (
    <button
      key={label}
      onClick={onClick}
      className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${
        active
          ? "bg-olive text-paper"
          : "bg-paper-raised text-ink-soft ring-1 ring-line"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="no-scrollbar mb-1 flex gap-2 overflow-x-auto px-5 pb-1">
      {chip("Anywhere", neighborhood === null, () => setNeighborhood(null))}
      {NEIGHBORHOODS.map((n) =>
        chip(n, neighborhood === n, () => setNeighborhood(n)),
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/NeighborhoodChips.tsx
git commit -m "feat(feed): neighborhood chip row with one-shot geolocation auto-detect"
```

---

## Task 5: Wire the chips into the feed

**Files:**
- Modify: `src/app/feed/page.tsx`

- [ ] **Step 1: Replace the file contents**

Replace `src/app/feed/page.tsx` with:

```tsx
"use client";

import { useMemo } from "react";
import AppShell from "@/components/AppShell";
import Feed from "@/components/Feed";
import HelpMeDecide from "@/components/HelpMeDecide";
import NeighborhoodChips from "@/components/NeighborhoodChips";
import { useStore } from "@/lib/store";
import { recommend } from "@/lib/recommend";

export default function FeedPage() {
  const profile = useStore((s) => s.profile);
  const liked = useStore((s) => s.liked);
  const saved = useStore((s) => s.saved);
  const ranked = useStore((s) => s.ranked);
  const seen = useStore((s) => s.seen);
  const neighborhood = useStore((s) => s.neighborhood);

  const restaurants = useMemo(() => {
    const scored = recommend({
      profile,
      liked,
      saved,
      ranked,
      seen,
      neighborhood,
    });
    return scored.map((s) => s.restaurant);
  }, [profile, liked, saved, ranked, seen, neighborhood]);

  return (
    <AppShell>
      <div className="h-full overflow-y-auto pb-24">
        <header className="px-5 pb-3 pt-9">
          <div className="font-display text-2xl font-semibold tracking-tight text-ink">
            Truffle<span className="text-olive">.</span>
          </div>
          <p className="mt-0.5 text-[13px] text-ink-soft">
            {neighborhood
              ? `Gems in ${neighborhood}`
              : "Before everyone finds out"}
          </p>
        </header>
        <NeighborhoodChips />
        <Feed restaurants={restaurants} />
        <HelpMeDecide />
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/feed/page.tsx
git commit -m "feat(feed): render neighborhood chips + steer recommend by area"
```

---

## Task 6: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Re-run both assert probes**

Run: `npx tsx scripts/neighborhoods.check.ts && npx tsx scripts/recommend-neighborhood.check.ts`
Expected: both print `OK`.

- [ ] **Step 2: Typecheck + production build (the primary gate)**

Run: `npm run typecheck && npm run build`
Expected: both succeed, no errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 4: Design-system regression grep**

Run: `grep -nE "#[0-9a-fA-F]{3,6}|text-white|bg-white/|bg-zinc|brand-" src/components/NeighborhoodChips.tsx src/app/feed/page.tsx`
Expected: no matches (semantic tokens only; no raw hex / retired dark classes).

- [ ] **Step 5: Manual visual pass at 375px**

Run: `npm run dev`, open http://localhost:3000/feed at a 375px viewport. Verify:
  - The chip row scrolls horizontally; "Anywhere" is active by default (or the detected area, if geolocation is granted).
  - Tapping a neighborhood highlights it (`bg-olive text-paper`), the subtitle swaps to "Gems in <area>", and that area's spots rise toward the top while others remain further down (feed is not emptied).
  - Tapping "Anywhere" clears the steer and restores the subtitle.
  - Reload keeps the last selection (persistence).

- [ ] **Step 6: Final commit (if any tidy-ups were needed)**

```bash
git add -A
git commit -m "chore(feed): verification pass for neighborhood-aware feed" --allow-empty
```

---

## Self-Review

- **Spec coverage:** centroids/nearest (Task 1) ✓; persisted selection + touched flag (Task 2) ✓; soft-steer scoring with exact boost + centroid falloff, never negative (Task 3) ✓; chip-row UI matching Search chips + one-shot auto-detect (Task 4) ✓; feed wiring + subtitle swap (Task 5) ✓; verification incl. typecheck/build/grep/manual (Task 6) ✓. Non-goals (cuisine/price/map/hard-filter/detail-page reason) correctly excluded.
- **Placeholders:** none — every code step shows complete code; every run step shows the command and expected output.
- **Type consistency:** `SignalState.neighborhood?`, store `neighborhood`/`neighborhoodTouched`/`setNeighborhood`, lib `NEIGHBORHOODS`/`neighborhoodCentroid`/`nearestNeighborhood`/`LatLng` are used identically across tasks. `clamp` already exists in `recommend.ts`; `haversineKm` signature matches `geo.ts`.
