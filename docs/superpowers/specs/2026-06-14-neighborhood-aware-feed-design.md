# Neighborhood-aware feed — design

**Date:** 2026-06-14
**Status:** Approved, ready for planning
**Roadmap item:** #1 (see `docs/ROADMAP.md`)

## Problem

The feed is the product's front door, but it has no steering: it renders the raw
`recommend()` output as one scroll. The dataset is fundamentally location-first
(neighborhood label, `lat`/`lng`, live distance on the detail page) yet there is
no way to say "show me gems around Pilsen tonight." A neighborhood selector
turns the feed into a place-aware discovery surface using data we already have.

## Goals

- Let the user steer the feed toward a Chicago neighborhood from the feed itself.
- Keep it a **soft steer**, not a hard filter: the chosen area floats to the top,
  nearby areas get a smaller lift, everything else still appears lower down. The
  feed never empties, preserving the "you're all caught up" end state (no dark
  pattern, no infinite supply).
- Make the steer **explainable**, consistent with the recommender's ethos: a spot
  in the chosen area carries an "In {neighborhood}" reason.
- Auto-detect the nearest neighborhood on first visit (geolocation), but never
  force it — fall back to "Anywhere."

## Non-goals (parked on the roadmap)

- Cuisine and price (`$`–`$$$$`) filters on the feed (roadmap item #2).
- A map view (roadmap).
- Hard filtering / "only this neighborhood" mode.
- Multi-neighborhood selection.
- Surfacing the "In {neighborhood}" reason on the **detail page** (the detail page
  recomputes `scoreRestaurant` without a selected neighborhood — acceptable).

## Design

### 1. Neighborhood centroids — `src/lib/neighborhoods.ts` (new)

Derive each neighborhood's center by averaging the `lat`/`lng` of its member
spots in `RESTAURANTS` at module load. No hardcoded coordinates, so it stays
correct across re-ingests. Exports:

- `NEIGHBORHOODS: string[]` — the distinct neighborhood names in a stable order.
- `neighborhoodCentroid(name: string): { lat: number; lng: number } | undefined`.
- `nearestNeighborhood(lat: number, lng: number): string` — the neighborhood whose
  centroid has the smallest `haversineKm` (reuses `src/lib/geo.ts`).

Pure module, safe to import on client or server.

### 2. State — `src/lib/store.ts`

Add to the persisted Zustand store:

- `neighborhood: string | null` — `null` means "Anywhere" (no steer; today's
  behavior). Default `null`.
- `neighborhoodTouched: boolean` — default `false`. Distinguishes "never chosen"
  from "explicitly chose Anywhere."
- `setNeighborhood(name: string | null)` — sets `neighborhood` and flips
  `neighborhoodTouched = true`.

Auto-detect only runs while `!neighborhoodTouched`, so it is a one-shot first-run
convenience that any explicit choice (including "Anywhere") permanently overrides.

`reset()` restores `neighborhood: null`, `neighborhoodTouched: false`.

### 3. Scoring — `src/lib/recommend.ts`

Extend `SignalState` with `neighborhood?: string | null`.

Add one soft-steer component to `scoreRestaurant`, active only when a neighborhood
is selected:

- **Exact match** (`r.neighborhood === state.neighborhood`): `+18`, and push the
  reason `{ label: `In ${state.neighborhood}`, weight: 18 }`.
- **Proximity falloff** (all spots, including the exact ones): using the selected
  neighborhood's centroid, add `clamp(1 - km / 6) * 10` where `km` is the
  haversine distance from the centroid to the spot. Adjacent areas get a gentle
  lift that decays to zero by ~6 km, so the steer is gradient, not a wall.

A spot sitting in the chosen area earns up to ≈ +28 (exact + ~full proximity).
That is meaningful but below the cuisine and underground signals, so taste still
leads the ranking. The component is never negative, so nothing is filtered out.

`recommend()` already accepts the full `SignalState`; no signature change beyond
the new optional field.

### 4. Selector UI — `src/components/NeighborhoodChips.tsx` (new, client)

A horizontal, `no-scrollbar` row of pills: `Anywhere` followed by the 9
neighborhood names. Active pill = `bg-olive text-paper`; inactive =
`bg-paper-raised text-ink-soft ring-1 ring-line` — matching the existing cuisine
chips on the Search page for visual consistency. Tapping a pill calls
`setNeighborhood(name)` (or `null` for Anywhere).

Auto-detect lives in this component as a one-shot `useEffect`, reusing the exact
fail-silent geolocation pattern from `UserDistance` (`getCurrentPosition` with
`maximumAge: 300000`, `timeout: 5000`, error callback is a no-op): if
`!neighborhoodTouched` and a position is granted, call
`setNeighborhood(nearestNeighborhood(lat, lng))`. If denied/unavailable, the feed
simply stays on "Anywhere." First paint shows "Anywhere", then settles to the
detected area — a quiet transition, fine under `prefers-reduced-motion`.

### 5. Wiring — `src/app/feed/page.tsx`

- Read `neighborhood` from the store and include it in the `recommend()` state.
- Render `<NeighborhoodChips />` directly under the header.
- When a neighborhood is active, softly swap the header subtitle from
  "Before everyone finds out" to e.g. "Gems in Pilsen".

## Design-system compliance

- Semantic tokens only (`paper`, `paper-raised`, `ink*`, `olive`, `line`) — no raw
  hex, no retired dark classes.
- No emoji as UI; chips are plain text.
- No dark patterns: soft steer, never empties, keeps the caught-up end state.
- Respects `prefers-reduced-motion` (global).

## Verification

- `npm run typecheck && npm run build` (the primary correctness gate).
- Manual visual pass at 375px: chips scroll, active state, subtitle swap, feed
  reorders on selection, "Anywhere" restores the prior order.
- Geolocation paths: granted → nearest pre-selected; denied → "Anywhere".
- No data regeneration; `npm run validate-data` is unaffected.
- Develop and verify locally (`npm run dev`) before any deploy.
