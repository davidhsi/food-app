# Design: the Discover home (merging Feed + Search)

**Date:** 2026-06-19
**Status:** Shipped
**Related:** `docs/decisions/2026-06-19-discover-home-merge.md`, supersedes part of `docs/decisions/2026-06-19-discovery-and-navigation-ux.md`

## Problem

The app had two list surfaces — `/feed` and `/search` — that felt redundant *and*
individually weak:

- **Feed wasn't actually editorial.** It rendered a flat, algorithm-ranked column of
  near-identical `SpotCard`s (24 at a time) under one tagline — no theme, no variety, no
  "why now." It read like search results with no query, which is why it blurred into Search.
- **Search duplicated the concierge.** It was literal keyword matching + `parseQuery()` →
  `recommend()`; the `/assistant` concierge already does natural-language intent better.
  Search's best feature was a hand-off *to* the concierge.

So there weren't two distinct surfaces — one genuinely distinct idea (browse) executed
thinly, plus a query surface that twinned `/assistant`. Merging two weak lists would just
yield one weak list, so the goal was a single *strong* editorial surface, not a merge.

## Approach

One **Discover** home at `/feed` with two modes, switched by the existing store fields
`searchSubmitted` / `searchCuisine` (no schema change):

### Browse mode (default)
A persistent `SearchBar` (sticky) on top, then editorial sections — each a different
slice of the *existing* engine, **no new scoring**:

1. `NeighborhoodChips` (unchanged soft-steer).
2. **Hero — "Tonight's gem":** the top `recommend()` result, large, with its #1 reason.
3. `HelpMeDecide` (unchanged "pick for me" CTA).
4. Carousels from `buildShelves()`: `In {neighborhood}` (if a chip is active) ·
   `Because you saved {X}` / `More like {X}` (if history) · `More {cuisine} you'd love`
   (if a cuisine is declared) · `Under the radar` (always).
5. **Tail — "More to discover":** the ranked remainder via the existing paginated `Feed`
   (PAGE=24, "Show more," "you're caught up").

Each spot is claimed by at most one shelf (priority order above); the tail excludes
everything featured. Shelves below the minimum size (3) don't render — honest, no filler.

### Search mode (query submitted OR cuisine selected)
The exact prior search-results logic, now on this home: literal `matches()` +
`parseQuery()` + `recommend()` on the filtered pool, the `fallback`/`nearby` honest
headers, and the elevated **concierge hand-off** for conversational queries. Clearing the
query returns to browse.

## Components & files

**New:** `src/lib/shelves.ts` (pure composer over `recommend()`/`gemScore`),
`src/components/discover/{SearchBar,Shelf,ShelfCard,HeroSpot}.tsx`. `ShelfCard` is the
compact carousel cousin of `SpotCard` — same data, `/api/photo` poster, save toggle,
`React.memo` (the home re-renders on every store mutation).

**Modified:** `src/app/feed/page.tsx` (the two-mode home, absorbs the old search memo +
near-me effect), `src/components/BottomNav.tsx` (drop the Search tab, relabel Feed →
"Discover" → 4 tabs), `src/app/search/page.tsx` (now `redirect("/feed")`).

**Unchanged (reused):** `recommend.ts`, `types.ts` (`gemScore`), `store.ts` (search
fields already existed), `SpotCard`, `Feed`, `NeighborhoodChips`, `HelpMeDecide`,
`neighborhoods.ts`, `analytics.ts`.

## Conventions preserved

No new scoring; semantic tokens only / no raw hex; no emoji-as-UI (the only emoji are in
`.replace()` strippers); no dark patterns (the "you're caught up" end-cap stays on the
tail; `HelpMeDecide` stays a single deterministic pick; honest titles, no counts);
bounded photo requests (shelves cap ~10, lazy; deep browse stays paginated); memoized
cards.

## Verification

`npm run typecheck && npm run build` both green. `/feed` = 6.17 kB (Discover home),
`/search` = 144 B redirect. Manual 375px pass: shelves appear/hide with profile/history/
neighborhood; search mode swaps in results and the concierge hand-off; clearing returns
to browse; scroll restores on back-from-detail; nav shows 4 tabs.
