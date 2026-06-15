# Truffle — Feature Roadmap

Living backlog of planned feature work. Each item graduates to its own
`docs/superpowers/specs/` design + `docs/superpowers/plans/` plan when picked up.

## In progress

- **Neighborhood-aware feed** — a neighborhood selector that filters/steers the
  feed's `recommend()` output by Chicago area (9 neighborhoods, 40–50 spots each).
  The feed has no steering today; the data is location-first (neighborhood,
  `lat`/`lng`, live distance). _Spec in progress._

## Planned

### Feed search & filter affordance
Bring lightweight discovery controls to the feed itself (today search/filter only
lives on the separate Search page).
- Inline search or quick filter on the feed.
- **Cuisine filter** (already exists on Search; consider sharing the control).
- **Price filter** by `$`–`$$$$` (`Restaurant.price` 1–4) — not yet a filter
  anywhere in the app.
- Open question: do neighborhood + cuisine + price compose into one shared
  filter bar, or stay separate? Decide once the neighborhood selector lands.

### Map view
A map surface for browsing gems spatially using the existing `lat`/`lng` data.
- Pins per spot, gem-score-aware styling, tap-to-detail.
- Ties into live geolocation (`UserDistance`) and the neighborhood selector.
- Open questions: map library/provider choice, clustering at city zoom,
  same-origin tile/key handling (mirror the photo-proxy key-safety pattern).

### Deferred-by-design features
Named in CLAUDE.md / specs as intentionally not-yet-built:
- **Taste-trainer calibration deck** — a finite onboarding/refinement deck that
  sharpens the taste profile.
- **One-spot focus reader** — a single-spot focused reading surface.
- **Earliness receipts** — real backend-backed "you found it early" proof
  (requires a backend; today earliness is derived from `buzz`, never live counts).
- **Dark mode**.
