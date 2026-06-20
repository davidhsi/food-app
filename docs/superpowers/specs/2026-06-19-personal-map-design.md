# Personal Map view — design

**Date:** 2026-06-19 · **Status:** Shipped

## Context

The app surfaces hidden-gem restaurants as an editorial feed, but there was no
**spatial** view: no way to see where your saved/been spots are, or what gems sit
around you right now. This adds a calm, personal **Map** tab.

Two ideas were brainstormed together — a map, and "open now" awareness in the
concierge. They're independent and have very different costs: the map is
self-contained (every restaurant already carries `lat`/`lng`), whereas "open now"
has **no data** (the Google Places ingest never requests hours). We scoped this
spec to the **map only**; "open now" becomes a separate later spec that includes a
full re-ingest. See the tail of this doc for the captured open-now seams.

## Goals / non-goals

- **Goal:** a phone-native map that always shows the user's **saved** ("want to
  try") and **been** (ranked) spots, plus **nearby gems** around them; tap a pin
  to peek a spot and jump to its detail page.
- **Non-goal:** an all-pins "explore the whole city" map. The dataset is ~1,607
  spots; rendering them all (and firing ~1.6k photo/marker mounts) is hostile to
  the calm ethos and needs clustering. We deliberately keep the pin set small and
  personal, so **no clustering is required**.

## Decisions (settled with the user)

- **Personal map**, not a full clustered city map.
- **Leaflet + react-leaflet** with the free **CARTO "Positron" light** raster
  basemap — no API key, lightweight, muted/calm. (The existing
  `GOOGLE_PLACES_API_KEY` is **Places-only**; Google Maps JS is a separate billable
  product whose tiles resist the warm palette. MapLibre vector was rejected as
  heavier for no v1 payoff.)
- **Geolocation** for the "nearby" set, reusing the gentle one-shot pattern from
  `UserDistance.tsx`; **fall back** to the user's set neighborhood centroid, then
  the Chicago city center, when denied/unavailable.

## Architecture

- **`/map` route** — `src/app/map/page.tsx`, a client page wrapped in `AppShell`
  (so it inherits the phone frame + bottom nav + onboarding gate). It renders a
  slim floating header and dynamically imports the map with
  `next/dynamic(..., { ssr: false })` — Leaflet touches `window` at module load,
  and the dynamic split also keeps the map's heavy chunk (Leaflet + the dataset)
  out of the route's First Load JS. Fires `track("map_open")` on mount.
- **`MapView` component** — `src/components/MapView.tsx`, the client-only Leaflet
  surface. Reads `saved`, `ranked`, `neighborhood`, `toggleSave` from the Zustand
  store.
  - **Basemap:** a CARTO `light_all` `TileLayer` with the required OSM + CARTO
    attribution (kept, restyled small/muted). Default zoom control disabled for a
    calmer surface; pinch/scroll zoom retained.
  - **Pin set** (`buildPins`, memoized) — deduped by id in priority order:
    1. **Been** — `ranked` → `getRestaurant(id)`, carries the user's 0–10 rank.
    2. **Saved** — `saved` minus any already-been.
    3. **Nearby gems** — from `RESTAURANTS`, excluding the above: nearest
       `NEARBY_POOL` (150) by `haversineKm` from the current center, then the top
       `NEARBY_CAP` (40) by `gemScore`. Recomputes when the center moves (e.g.
       once geolocation resolves). No counts.
  - **Markers** via `L.divIcon` (raw HTML, so Tailwind token classes apply and we
    sidestep Leaflet's default-marker-image bug): **saved** = `gem` dot, **been** =
    `olive-deep` pill showing the rank, **nearby** = small `olive` dot, **user** =
    `ink` dot with a soft halo.
  - **Selection → bottom card.** Clicking a marker sets local `selected` state and
    raises a compact, token-styled card (thumbnail via the same-origin
    `/api/photo` poster, name, ★ rating, ◆ gem, neighborhood, your rank for been
    spots) with a **save toggle** (`track("save_toggle", … source:"map")`) and a
    `Link` to `/restaurant/[id]`. We use a bottom card, not a Leaflet popup bubble
    — nicer on mobile and fully tokenized.
  - **Location:** one-shot `navigator.geolocation.getCurrentPosition` on mount;
    on success center+zoom to the user and drop a user dot; on denial keep the
    fallback. A **locate** control re-requests. A `Recenter` child
    (`useMap`) imperatively syncs the Leaflet view and runs `invalidateSize()`
    once (the container is absolutely positioned, so its size can be 0 at first
    paint).
  - **Legend:** a minimal token chip stack (Saved · Been · Nearby gem). No filter
    toggles in v1 (YAGNI).
- **Nav:** a 5th `BottomNav` tab using the existing `PinIcon` — order
  **Feed · Search · Map · AI · You**.
- **Analytics:** `map_open` + `map_pin_tap` added to the `AnalyticsEvent` union.
- **Chrome:** Leaflet attribution/links restyled to the palette in `globals.css`.
- **Shared geo:** `CHICAGO_CENTER` added to `src/lib/geo.ts` (mirrors the ingest
  pipeline's `distanceKm` origin) for the fallback center.

## Design-system guardrails

Semantic tokens only in our UI (the CARTO tiles are the lone third-party surface);
no emoji (text glyphs ◆ ★ are fine); photos via the same-origin proxy; no dark
patterns (no live counts, no roulette; quiet motion, `prefers-reduced-motion`
honored globally).

## Verification

- `npm run typecheck && npm run build` — both pass; `/map` First Load JS is ~101 kB
  (vs ~891 kB on data-heavy routes) confirming the `ssr:false` split keeps Leaflet
  + the dataset in a lazy chunk. `GET /map` returns 200 with no server error.
- Manual 375px pass: Map tab activates; allow geolocation → centers on user +
  nearby gems; deny → falls back to neighborhood/Chicago and still shows
  saved/been + city gems; saved=`gem`, been shows rank, nearby=`olive`; tap pin →
  bottom card → save toggle updates the store → link opens detail.

## Future (separate spec — not built here): "Open now" concierge

Captured so the findings aren't lost. Requires, in order:
1. **Ingest:** add `regularOpeningHours` + `utcOffsetMinutes` to the field mask in
   `scripts/places.ts`, extend `RawPlace`/derive, re-run `npm run ingest`
   (billing). Hours land in the full dataset; show an honest "hours via Google —
   confirm with the spot" caveat.
2. **Engine:** `isOpenNow(r, userTimeMs)` comparing the client's time against the
   venue's own UTC offset; add time-intent detection to `parseQuery()` and an
   open/closed step in `scoreRestaurant` (`src/lib/recommend.ts`).
3. **Surfaces:** client sends `userTime`; `/api/assistant` passes `isOpen`/`hours`
   into the candidate JSON + Claude prompt.
