# Design decision: discovery & navigation UX (search ↔ concierge, "near me", state)

**Date:** 2026-06-19
**Status:** Shipped to `main` (PR #7)
**Author:** David Hsi (with Claude)
**Related:** `docs/feature-timeline.md`, `docs/decisions/2026-06-19-ordering-and-dish-guidance.md`

## Problem & goal

A UI/UX pass over the discovery surfaces surfaced a few issues that were more than
cosmetic — they touched how the two text-input surfaces (the **search** bar and the
**AI concierge**) relate, and how navigation state behaves. The goal was to fix them
**without** changing the product's brain: `recommend.ts`, `ranking.ts`, and the data
pipeline are presentation-frozen, so all of this is page/glue/store work. Onboarding &
shell were owned by a parallel session and left untouched.

This record captures the non-obvious calls (and the alternatives rejected). The routine
polish in the same PR — a11y labels on the gem badge/rating, 44px touch targets, the
RankModal close/Escape/scroll-lock, the "you're caught up" end-cap, "Link copied"
feedback, capping "Pick again" so it isn't a roulette — is logged in
`docs/feature-timeline.md` and not re-argued here.

## Key decisions & rationale

### 1. Search and the concierge stay two tools — but search never dead-ends
Both surfaces accept natural-language input, so users reasonably type a full question
("what to eat around me") into search — which previously returned **"No matches"**, even
though the concierge would happily answer it. We considered and **rejected**:
- **Merging them into one box.** They're good at different things: search is a
  stateless, instant, free, typo-tolerant *filter*; the concierge is a stateful,
  slower, paid *conversation*. Routing every keystroke through the LLM would make the
  simple cases heavy/chatty and cut against the calm ethos (and cost).
- **Relabeling search as a pure filter** (placeholder/hint only) — cheap, but it just
  hides the broken-feeling behind copy instead of fixing it.

**What shipped instead:** search **never dead-ends.** When a query has no literal match,
it falls back to taste-ranked picks under an honest header — *"No exact matches — here's
what we'd recommend"* — reusing the recommend engine that already never returns empty.
And it **bridges** to the concierge: an "Ask the concierge about '…'" hand-off
deep-links to `/assistant?q=…`, which auto-asks once on arrival (then strips the param so
returning doesn't re-ask). The two feel like one system, with the concierge as the home
for open-ended questions — without forcing the user to pick the right box up front.

### 2. "Near me" resolves to a neighborhood, not a GPS radius
Both surfaces now detect "near me / around here" intent (in `parseQuery`, so search,
concierge, and the API agree) and steer to the user's location. Location resolves
**client-side** (`resolveNearbyNeighborhood()` → browser geolocation → nearest
neighborhood centroid, fail-silent); the concierge posts the resolved neighborhood to
`/api/assistant`, which validates it against the real set and feeds it the same steer
used for explicitly-named areas.

**Why neighborhood-level, not exact distance:** the whole app reasons about location by
neighborhood (the dataset is organized that way; `distanceKm` is deliberately *not*
surfaced as a real user distance — see `CLAUDE.md`). A neighborhood centroid match is
the honest, consistent unit. Both surfaces degrade gracefully to city-wide taste ranking
if location is denied or unavailable — never an error, never an empty result.

### 3. Ephemeral search/concierge state lives in the store, in-memory only
Tapping a recommendation unmounts the page (App Router); pressing back remounted it
fresh, wiping the query/results and the whole conversation. We moved that state
(`searchQuery/Submitted/Cuisine/GeoNbhd`, `assistantMessages`) into the Zustand store —
a tab-lifetime singleton that survives navigation.

**Why a `partialize` (in-memory, not persisted):** the store otherwise persists
everything to `localStorage`. Search text and a chat transcript are *ephemeral* — they
should survive a back-button round-trip but **not** reappear stale on a fresh app open.
So `partialize` was added to persist only durable user data (profile/saved/ranked/etc.)
and keep these fields in memory. (This also documents the persistence boundary, which
was previously implicit "persist all".)

### 4. Scroll restoration is manual, keyed per surface
Because the app scrolls inside **inset child containers** (not the window), neither the
browser nor Next restores scroll on back-navigation. A small
`useScrollRestoration(key)` hook saves each list's `scrollTop` and restores it on
remount (module-level map → tab-lifetime, resets on full reload). The feed additionally
persists its "Show more" page window keyed by list content, so a *deep* scroll survives
the round-trip while still resetting on a real list/neighborhood change. Search keys its
position by `query + cuisine` so a *new* search lands at the top but returning to the
*same* results restores the place.

**Caveat (by design):** restoration assumes the list re-renders at the same height it had
before — which holds here because cards are fixed-height and the list data is preserved
in the store. It is not a general solution for content whose height settles
asynchronously.

## Status

Shipped in PR #7. All changes are presentation/glue/store only; the recommender,
ranking, and ingest are unchanged. Deferred / not in scope: onboarding & shell a11y
notes (parallel session), and a unified loading/skeleton system (the surfaces here have
no async data loaders — the feed/search read local synchronous data, and the concierge's
loading state is already handled).
