# Truffle — Feature Roadmap

Living backlog of planned feature work. Each item graduates to its own
`docs/superpowers/specs/` design + `docs/superpowers/plans/` plan when picked up.

## Shipped

- **Neighborhood-aware feed** — neighborhood selector that soft-steers the feed
  by Chicago area, with first-run geolocation auto-detect.
  Spec: `specs/2026-06-14-neighborhood-aware-feed-design.md`.
- **Launch hardening** (2026-06-19) — analytics (Vercel Analytics + Speed
  Insights + a typed `track()` layer), error/404 surfaces (`error.tsx`,
  `global-error.tsx`, `not-found.tsx`, detail-page `notFound()`), per-restaurant
  OG images + dynamic metadata, per-IP rate limiting on `/api/assistant`, and an
  accessibility labeling pass. Spec:
  `specs/2026-06-19-launch-hardening-design.md`.
  - **Deploy note:** set `NEXT_PUBLIC_SITE_URL` to the canonical domain so
    OG/canonical URLs use the branded host (not per-deployment `VERCEL_URL`).

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

### Launch follow-ups
Surfaced by the launch-hardening pass (`specs/2026-06-19-launch-hardening-design.md`):
- **Hard global rate limit** — replace the per-instance in-memory limiter on
  `/api/assistant` with a shared store (Upstash Redis) if abuse warrants it.
- **Data coverage rebalance** — neighborhoods are uneven (Logan Square ~20% vs
  Greektown ~2%); re-ingest with targeted probes or curate thin areas.
- **"Not for me" signal** — negative-feedback control on the detail page feeding
  `recommend()` (hinted in CLAUDE.md, not yet wired).
- **Analytics dashboards** — define funnels/cohorts once `track()` events accrue.

### Deferred-by-design features
Named in CLAUDE.md / specs as intentionally not-yet-built:
- **Taste-trainer calibration deck** — a finite onboarding/refinement deck that
  sharpens the taste profile.
- **One-spot focus reader** — a single-spot focused reading surface.
- **Earliness receipts** — real backend-backed "you found it early" proof
  (requires a backend; today earliness is derived from `buzz`, never live counts).
- **Dark mode**.
