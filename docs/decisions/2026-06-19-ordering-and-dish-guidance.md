# Design decision: ordering & dish guidance ("what should I order here?")

**Date:** 2026-06-19
**Status:** Shipped to `main` (PRs #2–#5)
**Author:** David Hsi (with Claude)
**Related:** `planning/2026-06-17-data-storage-db-assessment.md` (the no-DB stance this builds on), `docs/feature-timeline.md`

## Problem & goal

Truffle was good at answering *which restaurant* — but not *"okay, I'm here, what do
I actually order?"*, the bigger real-world pain point. The goal: help people decide
what to order (and flag allergens) **without** breaking the app's load-bearing
constraints — no backend/DB/auth, works offline / without an API key, and the calm
"Warm Editorial" ethos (no engagement-bait, **no fabricated/implied counts**).

This record captures the decisions across the four PRs that built it, so future
readers know not just what exists but what was deliberately *rejected* and why.

## What shipped (one section, progressive enhancement)

The restaurant detail page has a **single** dish section, **"What to order"**
(`src/components/OrderGuide.tsx` ← `src/lib/order.ts`):
- 2–3 taste-aware picks drawn **only** from the restaurant's real `signatureDishes`
  (never invents a dish), each with a "why it fits you".
- An optional inline **crowd note** ("★ Reviewers love it for …") from
  `Restaurant.topDishes`.
- An optional **allergen caution** ("◷ May contain … — ask the kitchen").
- Renders instantly from the full record the page already holds; *upgrades* via
  `/api/order` (Claude) only when `ANTHROPIC_API_KEY` is set.
The concierge (`/api/assistant`) answers "what should I order at X?" by routing to the
same engine (`src/lib/order.server.ts`).

## Key decisions & rationale

### 1. Request-time generation over existing data — not a new ingest dataset (PR #2)
The picks reason over fields we already have (`signatureDishes`, `insiderTip`, taste
profile). Deterministic local guide is the always-on baseline; Claude only refines it.
**Why:** ships immediately, no dataset regen, and preserves the keyless/offline
guarantee. Mirrors the existing `/api/assistant` fallback pattern.

### 2. Allergies are request-time cautions, ordering-only — not a recommendation filter (PR #3)
Added a `TasteProfile.allergies` profile (US "big 9", captured in onboarding, distinct
from dietary *preferences*). Per-dish cautions = a conservative dish-name keyword scan
(`dishAllergenFlags`, keyless) **unioned** with Claude's read when keyed.
**Why / honesty rule:** keyword matching can't see hidden ingredients, so cautions only
ever *add* a warning and never claim a dish is allergen-free — the "confirm with staff"
note always shows. The recommendation engine is intentionally **not** allergy-filtered
(an allergy is a safety caveat, not a taste signal).

### 3. Dish top-3 is a CROWD signal derived editorially — not live user voting (PR #4)
The user wanted a per-restaurant "crowd favorite" top-3. We **declined live cross-user
voting** and instead distill `Restaurant.topDishes` from review text at ingest (Claude
Haiku, validated ⊆ `signatureDishes`).
**Why voting was rejected** (two independent reviews concurred):
- It needs shared, writable, aggregated state → a backend + DB + identity + anti-abuse
  + moderation. That trips the deferred-DB triggers in the data-storage assessment.
- **Cold-start is structural, not transient.** The product's wedge is *low-buzz* spots
  with the fewest users; per-dish that means ~0–1 votes each. "Crowd favorite — 1 vote"
  is exactly the implied-count dishonesty the ethos forbids, and it goes dark precisely
  on the hidden gems the app exists for.
- A review-derived signal is *more* credible at this scale (hundreds of reviews per
  spot) **and** needs zero live infra.
Live voting remains deferred behind a hard "never" guardrail list (no count-less vote
rankings, no sub-threshold "crowd favorite", never cross-restaurant, no
streaks/vote-to-unlock, never a write path without dedup, never break keyless).

### 4. No personal per-dish ranking; one section, not four (PR #4 built it, PR #5 removed it)
PR #4 also shipped a local-only personal pairwise dish ranker ("Your picks here") and
left "What reviewers love" + "Signature dishes" as separate sections. In review this was
**redundant** — four sections over the same ≤4 dish names. PR #5 consolidated to one:
- **Cut** the personal dish ranker — over a ≤4-dish pool pairwise ranking is
  ceremony-without-payload, it's a post-visit data-entry task on a pre-visit discovery
  screen, and a personal scored leaderboard cuts against the calm ethos. (Restaurant
  ranking earns the mechanic; dishes don't.)
- **Cut** the "Signature dishes" pill list — a strict subset of "What to order".
- **Folded** the crowd note *into* each pick instead of a parallel section (also fixed a
  latent bug where the taste "why" silently dropped the review note).
**Lesson:** with ≤4 dishes there's room for exactly one well-made dish section.

### 5. Per-dish photos: deferred on honesty grounds
Our only image source is Google Places photos via the `/api/photo` proxy — they're
**restaurant-level with no dish mapping**. Labeling an arbitrary food photo as a named
dish would misrepresent it (same integrity problem as fabricated counts). Real per-dish
photos would need a Claude-vision ingest pass (confidence-gated) or user uploads
(storage/moderation/backend) — both deferred.

## Status of the editorial crowd note
`topDishes` ships dormant: it's empty until a keyed `npm run ingest` populates it (needs
`GOOGLE_PLACES_API_KEY` + `ANTHROPIC_API_KEY`), and the inline note simply doesn't
render until then. This is the same work as the deferred **Phase 3** ingest dish
enrichment (richer per-dish data for fully-offline guides).
