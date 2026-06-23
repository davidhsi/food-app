# Design decision: pre-stored dish descriptions (Ordering Phase 3, hybrid)

**Date:** 2026-06-21
**Status:** Built on branch `worktree-horizontal-scroll-memory` (not yet merged). Full enrichment has run: **1,588 / 1,600** restaurants carry `dishDescriptions` (the 12 without have no listed dishes).
**Author:** David Hsi (with Claude)
**Related:** `docs/decisions/2026-06-19-ordering-and-dish-guidance.md` (the ordering feature this extends — its closing note named this as deferred "Phase 3"), `planning/2026-06-17-data-storage-db-assessment.md` (no-DB stance), `docs/feature-timeline.md`

## Problem

The detail page's "What to order" section rendered a deterministic local guide
**instantly**, then *upgraded* it via `/api/order` (Claude) ~6–7s later. Two problems
surfaced once the section became a collapsed accordion (2026-06-21 polish):

1. **Latency** — the richer descriptions took several seconds to appear.
2. **Reorder** — the Claude upgrade *replaced the whole pick list* (its own order + its
   own wording), so the visible dish-name list visibly reshuffled a few seconds after
   load. Jarring, and trust-eroding on the one section users came to read.

The user likes the long, rich descriptions and asked whether we could "store them in a
table" instead of generating them per request.

## Decision: hybrid — pre-store dish-centric descriptions, keep personalization local

We **pre-generate a rich, dish-centric description per dish at ingest** and store it in
the dataset, then render it **instantly** on the detail page. We **drop the request-time
`/api/order` upgrade on the detail page**. The personal angle stays via the existing
deterministic local taste line (`tasteWhy()` in `order.ts`), which is already instant.

So an expanded dish row now shows, all rendered offline with zero network:
- the **rich description** (pre-stored, dish-centric — "what it is / why it's a standout") — lead
- the optional **crowd note** (`topDishes`)
- the optional **allergen caution** (local keyword scan, per-user)
- the local **taste line** (e.g. "an easy yes for a ramen fan") as a **fallback only** —
  shown when a dish has no stored description, so the panel is never empty. (Initially the
  taste line was always layered under the description; on review the generic one-liner read
  as redundant filler beneath the richer prose, so it was demoted to a fallback. Consistent
  with the finding below that the personalization gain here is marginal.)

### Why this over keeping the live call

The key reframing: **the live Claude call was not what made the guide *personalized*** —
the local engine already personalizes off the same inputs (cuisines/spice/adventurousness/
allergies), instantly. The live call only added richer *wording*. So the real trade was
"nicer prose" vs. "6–7s latency + a visible reorder + a per-view API call." For the calm,
honest ethos (and plain engagement: latency + content-shuffle on the primary section is a
net negative), instant wins. The hybrid keeps the rich prose without any of the cost (the
local taste line remains available as a no-description fallback).

This also fits the architecture's load-bearing constraints: no DB (the "table" is the
committed dataset JSON), works keyless/offline (falls back to the local guide with no
description), and keeps the client bundle lean (see below).

## Mechanics

- **Field:** `Restaurant.dishDescriptions?: { dish: string; desc: string }[]`, each `dish`
  ∈ `signatureDishes`. **Detail-only** — added to `DETAIL_ONLY_FIELDS` in
  `scripts/split-data.ts`, so it ships only in the server `full` dataset
  (`restaurants.generated.json`), never the client `core`. The detail page already loads
  the full record server-side (`getFullRestaurant`), so `OrderGuide` gets the text for
  free with no payload cost to the feed/search/map surfaces.
- **Generation:** `generateDishDescriptions()` in `scripts/editorial.ts` (Claude Haiku,
  the same model + keyless-fallback pattern as the rest of editorial). It describes the
  dishes the guide actually shows (the `topDishes`/first-3 picks), grounded only in the
  name + cuisine + blurb — **never invents** (validated ⊆ `signatureDishes`, mirroring
  `topDishes`).
- **Population via a targeted enrichment pass, NOT a full re-ingest.**
  `scripts/enrich-dish-descriptions.ts` reads the existing generated dataset, adds *only*
  `dishDescriptions`, and re-derives `core`. **Why not `npm run ingest`:** a full ingest
  re-pulls Places and regenerates *all* editorial (blurb/tips/topDishes), which — Haiku
  being non-deterministic — would churn existing, already-good copy just to add one field.
  The enrich pass is surgical, idempotent (skips already-enriched records), and supports
  `--limit N` for a cheap partial test before the full ~1.6k-record run. It needs
  `ANTHROPIC_API_KEY`; without it, nothing is written and the app shows the local guide.
- **Validation:** `scripts/validate-data.ts` asserts every `dishDescriptions[].dish` is in
  that record's `signatureDishes`.

## Dormant until populated
Like `topDishes`/`hours`, `dishDescriptions` ships empty until the enrichment pass runs.
Until then `OrderGuide` renders the instant local guide **without** a description line —
no regression beyond losing the (slow, reordering) Claude prose we deliberately removed.

## Considered for later: Option B (keep live, but lock the order)
If taste profiles later get much deeper (mood, "vegetarian tonight", dietary context a
static field can't hold), a *live* model genuinely tailors more than a pre-stored line. At
that point the fix is **not** the old behavior but **Option B**: keep the request-time
call yet **lock the pick order to the local guide** and only enrich the (hidden) description
text in place, matched by dish name — so the visible name list never reshuffles. We chose
the hybrid now because today's profile is shallow and the prose lives behind a tap, making
the live call's marginal value low. Option B remains the documented upgrade path.

## Also in this branch (separate small UX tweaks)
- **Horizontal scroll memory:** Discover carousels now remember their scroll position
  across detail-page navigation (generalized `useScrollRestoration` with an `axis` param).
- **Collapsible "What to order":** each dish is a tappable accordion row (name + allergen
  dot when relevant); details expand on tap. Decluttered the densest block on the page and
  is what made the order-guide reorder visible, motivating this decision.
