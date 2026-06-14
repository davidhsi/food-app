# Truffle — find the spots before everyone else

A **calm, editorial discovery app for under-the-radar restaurants**. Where Google and Yelp surface the obvious and the crowded, Truffle digs up the hole-in-the-walls, no-sign supper clubs, and parking-lot taco trucks the locals guard — ranked for *your* taste, with the insider tip to order like a regular.

> MVP built with Next.js 14 (App Router) + TypeScript + Tailwind + Zustand.

### Why this angle?

The defensible wedge isn't another video feed or another star-rating clone; it's **anti-mainstream discovery**: the status and FOMO of finding a place *first*, where the data is genuinely bad and users are underserved. Truffle is built around a **"gem score"** (high quality × low mainstream buzz) that runs through the feed, search, and the AI concierge. The result is an editorial, taste-driven experience that feels closer to a trusted friend's recommendations than an algorithmic scroll.

## ✨ What it does

| Feature | Description |
| --- | --- |
| **Onboarding** | A quick taste quiz — cuisines, vibes, dietary, spice/adventurousness, **and a "hidden gems vs. hotspots" dial** — builds your taste profile. |
| **Feed** | A calm, editorial discovery feed. Each card is intentionally minimal — hero photo, **gem score**, name, one metadata line, and a save — with the depth (the "why", insider tip, earliness) revealed on the detail page. Ends with a "you're all caught up" state, not an infinite scroll. |
| **Help me decide** | Can't choose? One tap surfaces a single confident pick with a written reason — a deterministic concierge shortcut, **not** a slot machine. |
| **Share a spot** | One tap shares a clean single-spot card to the group chat (Web Share API, clipboard fallback). |
| **Search** | Search by dish, vibe, neighborhood, or plain English ("hole in the wall", "where locals eat", "hidden gems"). Underground-intent queries rank the whole city by gem score. |
| **AI Concierge** | Chat in natural language and get matched gems with the **insider tip** worked in. **Claude**-powered when an API key is set (biased toward gems), with a deterministic local fallback. |
| **Beli-style ranking** | Mark a place "been" and rank it through **pairwise comparisons** (binary-search insertion) → a personal 0–10 leaderboard. |
| **Profile** | Your **Been** leaderboard, **Want to try** saves, liked spots, and editable taste profile. |

Everything persists locally (Zustand + `localStorage`), and your likes / saves / rankings **feed back into the recommendation engine** — the more you use it, the better the feed gets.

## 🎨 Design

Truffle's look is **"Warm Editorial"** — calm and curated, deliberately *not* a loud doomscroll, casino, or dating-app swipe deck.

- **Palette ("Garden"):** paper `#F4F1E8` · ink `#1d2014` · olive accent `#5c6b2e` · gem `#cfe08a`, defined as semantic tokens in `tailwind.config.ts` (no raw hex in components).
- **Type:** Fraunces (display) + Inter (body), loaded via `next/font`.
- **Principles:** one surface treatment (no glassmorphism), an SVG icon family (no emoji as UI), quiet motion that respects `prefers-reduced-motion`, and a visible end state instead of infinite supply.

The design decisions and the feed-mechanic rationale are documented in `docs/superpowers/specs/2026-06-13-truffle-redesign-design.md`, with the build breakdown in `docs/superpowers/plans/2026-06-13-truffle-redesign.md`.

## 🧠 The recommendation engine

`src/lib/recommend.ts` is a content-based recommender with an **explainability layer**. Each restaurant is scored against:

1. Declared taste profile — cuisine, price, vibe, dietary (near-hard constraint), spice
2. **Underground bias** — rewards high-quality, low-buzz **hidden gems** (`gemScore = quality × (1 − buzz)`) and, for gem-seekers, demotes crowded tourist hotspots
3. **Adventurousness** — rewards novel cuisines for explorers
4. Base quality — community score + popularity
5. **Implicit affinity** — an interaction vector learned from what you've liked, saved, and ranked highly (content-based collaborative signal)
6. Proximity + novelty damping (down-ranks already-seen cards)

Every component emits a human-readable reason, so the feed can tell you *why* a spot showed up. Sorting is done on the **unrounded** match score to avoid display-tie ordering artifacts.

## 🤖 AI concierge (optional Claude integration)

The `/api/assistant` route uses the local engine to build a candidate pool, then — **if `ANTHROPIC_API_KEY` is set** — asks Claude to pick the best matches and write the reply. Without a key it falls back to the local taste engine, so the feature always works.

```bash
# optional — enables the Claude-powered concierge
export ANTHROPIC_API_KEY=sk-ant-...
export ANTHROPIC_MODEL=claude-sonnet-4-6   # optional, this is the default
```

## 🚀 Run it

### Locally

```bash
npm install
npm run dev      # http://localhost:3000
```

```bash
npm run build && npm run start   # production
npm run typecheck                # strict TS check
```

The UI is framed as a phone on desktop and goes full-screen on mobile widths.

### Generating the restaurant data

The committed dataset (`src/lib/restaurants.generated.json`) is produced by the ingest pipeline — you don't need to run it to develop the UI, only to refresh the data:

```bash
# .env (gitignored)
GOOGLE_PLACES_API_KEY=...      # required — enable "Places API (New)" in Google Cloud
ANTHROPIC_API_KEY=sk-ant-...   # optional — grounded editorial; else a deterministic template

npm run ingest                 # pull → derive gem fields → Claude editorial → write JSON
npm run ingest -- --sample     # offline 2-record run from the fixture (no keys)
npm run validate-data          # assert dataset invariants
```

Restaurants, gem scores, editorial, and cuisines are baked into the JSON, but **photos need `GOOGLE_PLACES_API_KEY` at runtime** (the `/api/photo` proxy serves them server-side).

### Deploy to a public URL (one click)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/davidhsi/food-app&project-name=truffle&repository-name=truffle)

The button clones the repo and deploys it. It runs with no database, but two server features read keys from *Settings → Environment Variables*: **`GOOGLE_PLACES_API_KEY`** for restaurant photos (the `/api/photo` proxy — without it cards render image-less), and optionally **`ANTHROPIC_API_KEY`** for the Claude-powered concierge (falls back to the local engine). Redeploy after adding them. Restrict the Google key to *Places API (New)* and set a billing cap — the proxy is public.

**Prefer to deploy your existing repo?** In the [Vercel dashboard](https://vercel.com/new): *Add New → Project → Import `davidhsi/food-app`* (Production Branch `main`), and click **Deploy**. Next.js is auto-detected; no extra config needed.

## 🗂️ Structure

```
src/
  app/
    onboarding/        taste quiz
    feed/              editorial feed + "Help me decide"
    search/            search → SpotCard results
    assistant/         AI concierge chat
    profile/           Been / Want-to-try / taste
    restaurant/[id]/   detail (the depth surface) + ranking
    api/assistant/     Claude (or local) recommender endpoint
  components/          SpotCard, Feed, HelpMeDecide, ShareSpot,
                       RankModal, BottomNav, AppShell, icons
  lib/
    recommend.ts       explainable scoring engine + NL query parser
    ranking.ts         Beli-style pairwise comparison ranking
    store.ts           Zustand store (persisted)
    data.ts            re-exports the generated restaurant dataset
    geo.ts             haversine distance (shared by ingest + client)
    restaurants.generated.json   real Chicago dataset (generated — do not hand-edit)
scripts/               ingest pipeline: Google Places → derive → Claude editorial → JSON
  app/api/photo/       server-side Google Places photo proxy (key stays server-side)
```

## 📝 Notes & strategic direction

The dataset is **real**: ~420 Chicago restaurants ingested from the Google Places API (New), with the hidden-gem `buzz` signal derived from review counts and the editorial copy + cuisines written by Claude Haiku. Photos are the venues' real Google photos, served through a server-side `/api/photo` proxy so the API key never reaches the browser. Regenerate anytime with `npm run ingest` (see *Generating the restaurant data* above).

The deliberate bet is **anti-mainstream discovery** rather than "another video feed." That reframes the go-to-market around problems that are actually tractable for a small team:

- **Useful at N=1** — the taste engine + concierge work for a single user with zero network, unlike a content feed that needs supply on day one.
- **Niche beachhead** — launch one city / one underserved community (e.g. a city's true hole-in-the-walls, or allergen-safe gems) where coverage is achievable and the "found it first" status compounds.
- **Curation over creation** — you need ~50 great spots per city from trusted locals, not a billion videos.

Natural next steps toward production: a real backend + accounts (move `recommend()` to a cached `/api/feed` and persist user state server-side), incremental/scheduled re-ingestion instead of a manual `npm run ingest`, multi-city coverage, a friends graph for social proof, and transaction monetization (bookings/affiliate). See the in-repo specs/plans for the prioritized backlog.
