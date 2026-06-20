# Design decision: merge Feed + Search into one editorial "Discover" home

**Date:** 2026-06-19
**Status:** Shipped
**Author:** David Hsi (with Claude)
**Related:** `docs/superpowers/specs/2026-06-19-discover-home-design.md`; **partially supersedes** `docs/decisions/2026-06-19-discovery-and-navigation-ux.md` §1

## Problem & goal

The `/feed` and `/search` tabs felt redundant *and* each felt weak. The diagnosis: both
were thin presentation over a strong brain. The feed was a flat ranked column (editorial
in name only); search was a keyword-matching budget version of the `/assistant` concierge.
Goal: replace both with **one strong editorial surface** — without touching the brain
(`recommend.ts`, `gemScore`, `parseQuery`, ranking, ingest are all unchanged).

## What shipped

A single **Discover** home at `/feed` with browse and search modes (see the spec). Browse
shows a hero + personalized carousels (`buildShelves()`, each a slice of `recommend()`/
`gemScore`) + a paginated deep-browse tail. Search reuses the prior results logic on the
same page. The standalone Search tab is removed (bottom nav 5 → 4: Discover · Map · AI ·
You); `/search` redirects to `/feed`.

## Key decisions & rationale

### 1. Merge two weak surfaces into one strong one — don't just dedup
Combining two flat lists yields one flat list. The fix had to make the surface *good*,
which meant making the feed genuinely editorial (variety, a hero, themed rows, a reason to
scroll), not merely removing a tab. **Rejected — minimal dedup** (kill Search, drop a bar
on the existing flat feed): cheap, but left "the feed also feels weak" unaddressed.

### 2. Shelves are pure compositions of the existing engine — no new scoring
Every row is a slice of the one `recommend()` pass (or a `gemScore` sort), claimed by at
most one shelf, with the remainder as the tail. `buildShelves()` (`src/lib/shelves.ts`)
adds zero scoring logic. This keeps the product's brain the single source of truth and
makes the home cheap to reason about. **Rejected — bespoke per-shelf rankers:** ceremony
without payload; would fork the ranking story.

### 3. Compact `ShelfCard` for carousels, not the full `SpotCard`
Horizontal shelves need a narrow card. **Rejected — reuse `SpotCard` capped at 3–4
vertical per shelf:** a stack of full-width cards under many headers gets long fast and
loses the magazine feel. `ShelfCard` mirrors `SpotCard`'s data/poster/save and is likewise
`React.memo`'d (the home re-renders on every store mutation).

### 4. Typed search lives on the home; the concierge owns natural language
A discovery home needs a fast keyword/cuisine lookup (one tap, instant, free), so the
search bar stays — but it does **not** try to be a second concierge. Conversational
queries surface the existing "Ask the concierge" hand-off prominently. **Rejected —
fold search entirely into `/assistant`:** puts quick lookup a conversation away.

This **refines** the earlier "search and concierge stay two tools" call
(`2026-06-19-discovery-and-navigation-ux.md` §1): that principle holds (filter vs.
conversation are different tools), but search is no longer its *own tab* — it's a mode of
the Discover home. The dead-end fallback and concierge bridge from that record are
preserved verbatim.

### 5. `/search` redirects rather than 404s
Kept as a one-line `redirect("/feed")` to guard old bookmarks/links. No in-app deep-links
pointed at `/search` (only `BottomNav` did); the concierge hand-off points *to*
`/assistant`.

## Status

Shipped. Presentation/glue only — recommender, ranking, ingest, and the store schema are
unchanged (`searchSubmitted`/`searchCuisine`/`searchGeoNbhd` already existed). Adjustable
defaults taken: tab labeled "Discover"; `HelpMeDecide` kept distinct from the hero;
`/search` redirects.
