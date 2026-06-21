# Design decision: Discover home polish — filter dropdowns, "Near me" default, wordmark-leads

**Date:** 2026-06-21
**Status:** Shipped
**Author:** David Hsi (with Claude)
**Related:** refines [`2026-06-19-discover-home-merge.md`](./2026-06-19-discover-home-merge.md); spec [`specs/2026-06-19-discover-home-design.md`](../superpowers/specs/2026-06-19-discover-home-design.md)

## Problem & goal

The Discover home shipped (2026-06-19) with three open judgment calls flagged at ship:
search-bar-vs-wordmark order, hero/`HelpMeDecide` redundancy, and how many filter rows
the top fold should carry. This was the planned **polish pass** to resolve them —
**presentation only; the brain (`recommend.ts`, `gemScore`, `parseQuery`, `shelves.ts`)
is untouched.**

## What shipped

- **Wordmark leads.** `Truffle.` + tagline render first; the `SearchBar` keeps
  `sticky top-0` and pins below the wordmark on scroll (was search-forward).
- **Hero ↔ HelpMeDecide de-duped.** `HelpMeDecide` takes an `excludeId` and drops the
  hero's restaurant from its pool, so the "Can't decide?" CTA never offers the spot
  already featured directly above it.
- **Two chip rows → one filter row of dropdown pills.** The 19-item cuisine strip and
  the 9-item neighborhood strip collapse into two pill-dropdowns side by side. New
  `src/components/discover/FilterSelect.tsx` (generic, token-styled anchored menu) +
  `NeighborhoodFilter.tsx`, replacing `NeighborhoodChips.tsx`.
- **"Near me" neighborhood option + default.** Menu is `Anywhere` → `Near me` → the 9
  areas. For a first-visit user with location granted it defaults to "Near me" (header
  reads "Gems near you"); it degrades honestly otherwise. New `neighborhoodNearMe` store
  flag decouples the label from the steer (under the hood it steers by the resolved
  nearest area).

## Key decisions & rationale

### 1. Collapse the twin chip rows into dropdown pills
Two horizontally-scrolling chip rows that looked identical actually did **opposite
things** — cuisine is a *filter* that flips the page into search-results mode; the
neighborhood is a soft *browse* steer that stays on the editorial home. Twins
misrepresented that. A dropdown also shows the **current selection in its label** (a
chip strip makes you scroll to find what's active), which matters most for the 19-item
cuisine list. Distinct leading icons (pin vs. utensils) reinforce that they differ.
**Rejected — keep chips** (options visible at a glance): the discovery in this app is the
*restaurants*, not the filter labels, and a 19-wide horizontal strip was the worse
offender. **Rejected — native `<select>`:** its OS-rendered menu can't carry the Warm
Editorial tokens; the anchored token-styled menu matches the system (cf. the Map's
bottom card). **Rejected — bottom sheet:** clipping risk inside the home's scroll
container near the top; an anchored menu avoids it.

### 2. "Near me" degrades honestly — it never fakes a location
Geolocation is permission-gated and often unavailable on desktop. "Near me" only becomes
the *shown* state once there's a real fix; on denial/timeout it shows a brief
**"Location off"** cue and leaves the prior selection in place. This mirrors the existing
"near me" **search** intent, which already refuses to claim "near you" without a fix.
**Rejected — fall back to Chicago-center / a faked location:** it would label citywide
results "Gems near you," violating the app's honesty norm. The cost (a dead-looking
button) is paid down with visible **Locating… / Location off** feedback instead of
silence.

### 3. Default to "Near me" only for first-visit users
The auto-default fires only when `neighborhoodTouched === false` **and** location is
granted. A returning user who already chose "Anywhere" or an area shouldn't be silently
re-prompted for location or have their choice overridden. Fresh users with location get
the location-first default; everyone else keeps their explicit state and can tap "Near
me" to opt in (which re-requests permission, so a denied first read is recoverable).

### 4. Exclude the hero from HelpMeDecide rather than dropping either
The passive hero ("here's a beautiful pick") and the active CTA ("pick one for me") are
distinct intents worth keeping; they only collided because both surfaced the top-ranked
spot. Excluding the hero from the CTA's pool keeps both without the duplicate.

## Status

Shipped. Verified by `npm run typecheck && npm run build` (clean) + a manual 375px pass;
merged to `main` (which auto-deploys to Production).
