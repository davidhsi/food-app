# Truffle — Feature Roadmap

Living backlog of planned feature work. Each item graduates to its own
`docs/superpowers/specs/` design + `docs/superpowers/plans/` plan when picked up.

> Shipped work is logged in [`docs/feature-timeline.md`](./feature-timeline.md);
> the *why* behind non-obvious calls lives in [`docs/decisions/`](./decisions/).

## In progress

_Nothing in active development right now — see
[`docs/feature-timeline.md`](./feature-timeline.md) for recently shipped work
(most recently: launch hardening, 2026-06-19)._

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
- **Ordering Phase 3 — ingest dish enrichment.** Per-dish data (descriptions, per-dish
  allergens/dietary/spice) generated at ingest for richer, fully-offline guides. Also
  the work that populates the dormant `topDishes` crowd note. Needs API keys + a regen.
- **Per-dish photos** — deferred on honesty grounds (Places photos are restaurant-level
  with no dish mapping). Would need a confidence-gated Claude-vision ingest pass or user
  uploads. See [the ordering/dish decision record](./decisions/2026-06-19-ordering-and-dish-guidance.md).
- **Live cross-user dish voting — declined (not just deferred).** Trips the deferred-DB
  trigger and is dishonest on low-buzz spots (per-dish cold-start). The crowd signal is
  delivered editorially instead (`topDishes`). Rationale + the hard "never" guardrails:
  [decision record](./decisions/2026-06-19-ordering-and-dish-guidance.md).
