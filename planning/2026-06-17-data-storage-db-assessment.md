# Truffle — Data Storage: DB / Warehouse Assessment & Performance

**Date:** 2026-06-17
**Status:** Decided & implemented (Phase 1 + Phase 2 shipped to `main`)
**Author:** David Hsi (with Claude)

## Problem & goal

The committed dataset grew from ~420 to **1,607 restaurants** and the app became
laggy. Two questions:

1. How are we storing restaurant data, and is it worth moving to a **database**
   or **data warehouse**?
2. Why did it get slow, and what do we do about it?

## How data is stored today

- **Single committed artifact:** `src/lib/restaurants.generated.json` (full,
  ~2.6 MB, 1,607 records) is the source of truth; regenerated via
  `npm run ingest`, never hand-edited.
- **Static import → client.** Consumed in-process: search/filter,
  `recommend()`/`gemScore`, neighborhood centroids — mostly client-side.
- **No DB / auth / accounts.** User state is Zustand + `localStorage`.
- **Two API routes only:** `/api/assistant`, `/api/photo`.

## Core finding: the lag was compute, not storage

Profiling the code (not the bytes) showed the slowdown was **client-side
rendering/compute that the bigger dataset merely exposed** — a DB or warehouse
would not have fixed it. Root causes, ranked:

1. The feed rendered **all ~1,607 cards at once** (no pagination) → ~1,607
   simultaneous `/api/photo` requests + DOM thrash. (Critical)
2. No memoization → any store mutation re-rendered every card. (High)
3. `recommend()` rebuilt history affinity **inside** `scoreRestaurant` for every
   restaurant, and did `RESTAURANTS.find()` (O(n)) per history item. (High)
4. ~2.6 MB JSON bundled into client JS (parse/eval cost). (Medium — the only
   factor that even partially implicates storage.)

## Decisions

| Decision | Choice | Why |
|---|---|---|
| **Data warehouse** (BigQuery/Snowflake/Redshift) | **No** | Category mismatch — warehouses are for OLAP analytics over large/streaming data. We have ~1.6k static records and no analytics workload. |
| **Transactional DB** (Postgres / SQLite / Turso) | **Defer** | Wouldn't fix the lag; adds infra/auth/sync the product doesn't yet need. Static-JSON-in-git gives zero infra, atomic versioned deploys, and an offline-capable, key-less local recommender. |
| **Fix the lag in the current architecture** | **Yes — done** | Phase 1 (rendering/compute) + Phase 2 (payload split). See below. |

### Adopt a DB later when ANY of these triggers hit
- **User accounts / cross-device sync** (move likes/saves/rankings off
  `localStorage`).
- **Per-restaurant freshness / partial updates** instead of full re-ingests.
- **Multi-city or > ~5–10k records.**
- **Server-side search/pagination** as the primary query path.

## What shipped

### Phase 1 — fix the lag (no new storage)
- `Feed` paginates (24/page, "Show more"), keeping the "you're caught up" end
  state; `SpotCard` is `React.memo`'d; card images use `loading="lazy"`.
- `recommend()` computes history affinity **once per pass**; affinity lookups use
  an O(1) `RESTAURANTS_BY_ID` map.
- `HelpMeDecide` scores once per state change; "Pick again" walks a cached top
  list.

### Phase 2 — hybrid client/server data split (DB groundwork)
The feed/cards/search/scorer never use `insiderTip` or `blurb` (~25% of the
payload) — only the detail page does. So:
- `scripts/split-data.ts` derives a client-safe `restaurants.core.json` (full
  minus those two fields); wired into `npm run ingest` + `npm run split-data`.
- `src/lib/data.ts` (client) imports `core`; new **server-only**
  `src/lib/data.server.ts` exposes the full records via `getFullRestaurant(id)`.
- The detail page is now a **server component** that loads the full record and
  hands it to the `RestaurantDetail` client component (editorial arrives
  per-record, on demand).
- Result: **First Load JS down ~21% on every screen** (feed 1.12 MB → 884 kB);
  the full dataset is no longer in any client bundle.

**This is the chosen hybrid, not a full server-side move.** Personalized scoring
needs each candidate's *and* the user's history's full fields, so moving the feed
fully server-side would add loading states and lose the offline/key-less feel.
That was explicitly declined for now.

## The future-DB seam

`src/lib/data.server.ts` (`RESTAURANTS_FULL` / `getFullRestaurant`) is the single
place a database would slot in: swap the JSON read for a query and every caller
stays the same. The natural next step before a DB — if payload/scale demands it —
is to move search/scoring behind a route handler so the client stops shipping the
core dataset too; that handler becomes the second DB seam.
