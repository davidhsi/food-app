# Personal Map view — a phone-native map of your spots + nearby gems

**Status:** Shipped (2026-06-19)

## Problem & goal

The app had no spatial view. Users couldn't see where their saved/been spots sit
or what gems are around them. Add a calm **Map** tab that fits the Warm Editorial
ethos — without turning into a heavy "explore everything" surface.

## What shipped

A `/map` route (`src/app/map/page.tsx`) rendering a client-only `MapView`
(`src/components/MapView.tsx`) on a Leaflet + CARTO light basemap. It pins the
user's **been** (with their 0–10 rank), **saved**, and **nearby gems**; tapping a
pin peeks a compact card with a save toggle and a link to the detail page.
Geolocation centers on the user with neighborhood/city fallbacks. A 5th
`BottomNav` tab (`PinIcon`) and `map_open`/`map_pin_tap` analytics were added.

## Key decisions & rationale

- **Personal map, not a full clustered city map.** *Rejected:* plotting all
  ~1,607 spots with marker clustering. That fights the calm ethos (a wall of
  pins), needs a clustering dep, and fires ~1.6k marker/photo mounts. Showing only
  saved + been + the top ~40 nearby gems keeps it personal, honest (no counts),
  and clustering-free.
- **Leaflet + react-leaflet + CARTO "Positron" light tiles.** *Rejected:*
  **Google Maps JS** — the existing `GOOGLE_PLACES_API_KEY` is Places-only, so it
  would mean enabling/billing a separate Maps product, and its tiles resist the
  warm palette. **MapLibre GL (vector)** — full style control but a heavier dep and
  more setup for no v1 payoff. CARTO light is free (no key), lightweight, and
  already muted.
- **`ssr:false` dynamic import for the map.** Leaflet touches `window` at module
  load. The split also keeps the heavy chunk (Leaflet + the ~1.6k dataset) out of
  the route's First Load JS — `/map` is ~101 kB vs ~891 kB on data-heavy routes.
- **Bottom card on selection, not a Leaflet popup bubble.** Nicer on mobile and
  fully tokenizable; popups are awkward to style to the palette.
- **divIcon markers with Tailwind token classes.** Leaflet renders marker HTML
  outside React, but global Tailwind utilities still apply — so we keep semantic
  tokens (no raw hex) and avoid Leaflet's default-marker-image bug. The CARTO tiles
  remain the one intentionally third-party-styled surface.
- **Geolocation with graceful fallback.** Reuses the gentle one-shot
  `getCurrentPosition` pattern from `UserDistance.tsx`; denial falls back to the
  set neighborhood's centroid, then `CHICAGO_CENTER`. Never blocks the map.

## Deferred (separate spec)

"Open now" concierge awareness was brainstormed alongside this but split out — it
needs a full Google Places re-ingest to capture hours (none exists today). Seams
are captured in `docs/superpowers/specs/2026-06-19-personal-map-design.md`.
