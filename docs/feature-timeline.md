# Truffle — feature timeline

A chronological log of shipped feature work (most recent first). Each entry links to
the deeper design/plan/decision doc where one exists. Forward-looking work lives in
`docs/ROADMAP.md`; the *why* behind non-obvious calls lives in `docs/decisions/`.

---

## 2026-06-19 — Launch hardening

The operational/polish layer for a public launch (product features unchanged).
Full design, decisions, and the analytics event vocabulary:
[`superpowers/specs/2026-06-19-launch-hardening-design.md`](./superpowers/specs/2026-06-19-launch-hardening-design.md).

- **Analytics.** Vercel Analytics + Speed Insights, plus a typed `track()` wrapper
  (`src/lib/analytics.ts`) wired into the key funnel events. New events go through
  `track()` (never `@vercel/analytics` directly) and stay in the `AnalyticsEvent` union.
- **Error surfaces.** Branded `error.tsx` / `global-error.tsx` / `not-found.tsx`;
  the restaurant detail route returns a real 404 (`notFound()`) for unknown ids.
- **SEO + per-restaurant OG images.** Detail route exports `generateMetadata`
  (server, via `getFullRestaurant`); `opengraph-image.tsx` renders a 1200×630 card
  with the real food photo inlined as a data URI. `src/lib/site.ts` centralizes
  `SITE_URL` — set `NEXT_PUBLIC_SITE_URL` in prod for canonical/OG URLs.
- **Rate limiting.** Best-effort per-IP limiter (15/min) on `/api/assistant`, 429
  with a friendly reply. Per-instance under Fluid Compute; upgrade to a shared store
  if a hard global limit is needed.
- **Accessibility.** Labeled search/assistant inputs + buttons; `aria-pressed` on
  save/like and neighborhood toggles.

_Deferred:_ hard global rate limit (shared store), neighborhood data rebalance, a
"Not for me" negative-feedback signal, analytics dashboards once events accrue.

## 2026-06-19 — Ordering & dish guidance ("what should I order here?")

Shipped the ordering feature arc (PRs #2–#5). Full rationale + rejected alternatives:
[`docs/decisions/2026-06-19-ordering-and-dish-guidance.md`](./decisions/2026-06-19-ordering-and-dish-guidance.md).

- **#2 — Ordering guide v1.** A detail-page **"What to order"** section + concierge
  support: 2–3 taste-aware picks from a restaurant's real `signatureDishes` (never
  invents a dish). Request-time, keyless deterministic baseline, Claude upgrade when
  keyed. New: `src/lib/order.ts`, `src/lib/order.server.ts`, `src/app/api/order/route.ts`,
  `src/components/OrderGuide.tsx`.
- **#3 — Allergy cautions.** A `TasteProfile.allergies` profile (US "big 9", new
  onboarding step) drives per-dish "may contain — ask the kitchen" cautions
  (keyword scan ∪ Claude). Ordering-only; the recommender is not allergy-filtered.
- **#4 — Dish top-3.** Editorial **crowd-favorite** dishes (`Restaurant.topDishes`,
  distilled from reviews at ingest) — explicitly **not** live user voting (cold-start
  would be dishonest on hidden gems; voting trips the deferred-DB trigger). Also added
  (then removed in #5) a local personal dish ranker.
- **#5 — Consolidation.** Collapsed four overlapping dish sections into the single
  "What to order" (folded the crowd note inline, cut the personal ranker + the
  redundant "Signature dishes" list + a duplicated insider tip).
- **Docs pass.** This timeline + `docs/decisions/` index & records.

_Deferred from this arc:_ per-dish photos (can't be sourced honestly from
restaurant-level Places photos) and **Phase 3** ingest dish enrichment (needs API keys
+ a regen; it's also what lights up the dormant `topDishes` crowd note).

## 2026-06-17 — Data storage assessment + performance

The dataset had grown to **1,607 restaurants** and the app got laggy. Decided
**against** a DB/warehouse for now and fixed the real cause (client compute/render).
Full record: [`planning/2026-06-17-data-storage-db-assessment.md`](../planning/2026-06-17-data-storage-db-assessment.md).

- **Phase 1 — perf.** Feed pagination (24/page) + `React.memo` + lazy images;
  `recommend()` computes history affinity once per pass with an O(1) `RESTAURANTS_BY_ID`.
- **Phase 2 — client/server data split.** `restaurants.core.json` (client) vs
  server-only full `restaurants.generated.json` via `src/lib/data.server.ts`; the detail
  page became a server component. First Load JS down ~21% on every screen. This is also
  the future-DB seam.

## 2026-06-16 — Ingest depth expansion

Ingest expanded to 15 neighborhoods with cuisine-targeted depth probes; the committed
dataset grew to ~1,607 spots (the growth that surfaced the perf work above).

## 2026-06-14–15 — Neighborhood-aware feed

A neighborhood chip row with one-shot geolocation auto-detect that **soft-steers**
`recommend()` toward an area (never a hard filter), plus neighborhood detection in
search/concierge queries. Spec/plan: `docs/superpowers/{specs,plans}/2026-06-14-neighborhood-aware-feed*`.

## 2026-06-14 — Real-data ingestion

Replaced seed data with a real Chicago dataset via the Google Places pipeline
(`scripts/ingest.ts` → `derive.ts` → `editorial.ts` w/ Claude Haiku → committed JSON).
Spec/plan: `docs/superpowers/{specs,plans}/2026-06-14-real-data-ingestion*`.

## 2026-06-13 — Truffle redesign

Rebrand + redesign from the prior dark, TikTok-style "ReelEats" reels feed to the calm,
editorial "Warm Editorial" app. Spec/plan: `docs/superpowers/{specs,plans}/2026-06-13-truffle-redesign*`.
