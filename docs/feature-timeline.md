# Truffle — feature timeline

A chronological log of shipped feature work (most recent first). Each entry links to
the deeper design/plan/decision doc where one exists. Forward-looking work lives in
`docs/ROADMAP.md`; the *why* behind non-obvious calls lives in `docs/decisions/`.

---

## 2026-06-19 — Chatbot voice naturalness

A voice/presentation pass over both chatbot engines so the concierge and the "what to
order" guide read like a friend who knows the city — and so a user can't tell the
keyless fallback from the Claude upgrade. Recommendation engine, scoring, and ingest
unchanged. Rationale + rejected alternatives:
[`docs/decisions/2026-06-19-chatbot-voice-naturalness.md`](./decisions/2026-06-19-chatbot-voice-naturalness.md).

- **Deterministic-seeded variation.** New `seededPick(pool, seed)` in `src/lib/order.ts`
  (shared, pure) varies the `tasteWhy` reasons, `orderGuideToReply` openers, intro
  fallback, and concierge `composeLocalReply` leads/closers — seeded by restaurant/dish
  id so a given spot reads consistently while a list stops repeating one sentence
  verbatim. Deterministic by design, **not** random (no slot-machine).
- **Dropped the "% match" machine tell** from the local concierge reply; a qualitative
  "strong fit" cue shows only when the score is high and the pick is in-area, else
  nothing — never a number.
- **Grouped allergen line** ("the X and Z might contain milk") instead of repeating "may
  contain" per dish; "confirm with the kitchen" unchanged.
- **Re-voiced both Claude prompts** (`askClaude`, `askClaudeOrder`) with shared voice
  guidance, a voice example, and an explicit ban on machine tells; STRICT-JSON contract
  and `sanitizePicks` validation untouched.

## 2026-06-19 — Discovery & navigation UX

A UI/UX pass over the discovery surfaces (presentation/glue/store only — the
recommender, ranking, and ingest are unchanged). Rationale + rejected alternatives for
the non-obvious calls: [`docs/decisions/2026-06-19-discovery-and-navigation-ux.md`](./decisions/2026-06-19-discovery-and-navigation-ux.md).

- **Search never dead-ends + concierge bridge.** A query with no literal match now
  falls back to taste-ranked picks under an honest "No exact matches — here's what we'd
  recommend" header, and offers an "Ask the concierge about '…'" hand-off that
  deep-links to `/assistant?q=…` (auto-asks once, then strips the param). Search and the
  concierge stay two distinct tools (instant filter vs. conversation), not merged.
- **"Near me" location awareness.** `parseQuery` detects near-me intent (shared across
  search/concierge/API); a client-only `resolveNearbyNeighborhood()` maps geolocation →
  nearest neighborhood centroid. Both surfaces steer to the user's area; graceful
  city-wide fallback if denied. Neighborhood-level by design, not a GPS radius.
- **State survives back-navigation.** Search inputs/results and the concierge
  conversation moved into the store, kept **in-memory only** via a new `partialize`
  (survive a back-button round-trip; reset on a fresh app open). Added
  `src/lib/useScrollRestoration.ts` (feed/search/concierge/profile); the feed also
  persists its "Show more" window so deep scrolls survive the round-trip.
- **A11y & flow polish.** RankModal close button + Escape + `role="dialog"` +
  background scroll-lock; aria labels on the gem-score badge & rating; 44px save target;
  an elevated "you're all caught up" end-cap; "Link copied" share confirmation; capped
  "Pick again" (not a roulette); chip clear affordance; concierge chat scroll/layout fix
  (`min-h-0` + in-flow input); OG card now includes the insider tip.

_Deferred:_ onboarding & shell a11y notes (parallel session); a unified
loading/skeleton system (these surfaces have no async data loaders).

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
