# 🍴 ReelEats — find the spots before everyone else

An **AI restaurant-discovery app for under-the-radar gems**, in the shape of a Reels feed. Where Google and Yelp surface the obvious and the crowded, ReelEats digs up the hole-in-the-walls, no-sign supper clubs, and parking-lot taco trucks the locals guard — ranked for *your* taste, with the insider tip to order like a regular.

> MVP built with Next.js 14 (App Router) + TypeScript + Tailwind + Zustand.

### Why this angle?
"Beli, but a Reels feed" front-loads the hardest problem in consumer — *content supply at scale* — which is exactly what Beli avoided. The defensible wedge isn't another video feed; it's **anti-mainstream discovery**: the status/FOMO of finding a place first, where the data is genuinely bad and users are underserved. So the product is built around a **"gem score"** (high quality × low mainstream buzz) that runs through the feed, search, and the AI concierge.

## ✨ What it does

| Feature | Description |
| --- | --- |
| **Onboarding** | A quick taste quiz — cuisines, vibes, dietary, spice/adventurousness, **and a "hidden gems vs. hotspots" dial** — builds your taste profile. |
| **For You feed** | A vertical, scroll-snapping reel feed. Each reel shows a **% match** badge, explainable **"why" chips**, and a **💎 Under the radar** badge on true gems. |
| **Search** | Search by dish, vibe, neighborhood, or plain English ("hole in the wall", "where locals eat", "hidden gems"). Underground-intent queries rank the whole city by gem score. |
| **AI Concierge** | Chat in natural language and get matched gems with the **insider tip** worked in. **Claude**-powered when an API key is set (biased toward gems), with a deterministic local fallback. |
| **Beli-style ranking** | Mark a place "been" and rank it through **pairwise comparisons** (binary-search insertion) → a personal 0–10 leaderboard. |
| **Profile** | Your **Been** leaderboard, **Want to try** saves, liked spots, and editable taste profile. |

Everything persists locally (Zustand + `localStorage`), and your likes / saves / rankings **feed back into the recommendation engine** — the more you use it, the better the feed gets.

## 🧠 The recommendation engine

`src/lib/recommend.ts` is a content-based recommender with an **explainability layer**. Each restaurant is scored against:

1. Declared taste profile — cuisine, price, vibe, dietary (near-hard constraint), spice
2. **Underground bias** — rewards high-quality, low-buzz **hidden gems** (`gemScore = quality × (1 − buzz)`) and, for gem-seekers, demotes crowded tourist hotspots
3. **Adventurousness** — rewards novel cuisines for explorers
4. Base quality — community score + popularity
5. **Implicit affinity** — an interaction vector learned from what you've liked, saved, and ranked highly (content-based collaborative signal)
6. Proximity + novelty damping (down-ranks already-seen reels)

Every component emits a human-readable reason, so the feed can tell you *why* a spot showed up. Sorting is done on the **unrounded** match score to avoid display-tie ordering artifacts.

## 🤖 AI concierge (optional Claude integration)

The `/api/assistant` route uses the local engine to build a candidate pool, then — **if `ANTHROPIC_API_KEY` is set** — asks Claude to pick the best matches and write the reply. Without a key it falls back to the local taste engine, so the feature always works.

```bash
# optional — enables the Claude-powered concierge
export ANTHROPIC_API_KEY=sk-ant-...
export ANTHROPIC_MODEL=claude-sonnet-4-6   # optional, this is the default
```

## 🚀 Run it

```bash
npm install
npm run dev      # http://localhost:3000
```

```bash
npm run build && npm run start   # production
npm run typecheck                # strict TS check
```

The UI is framed as a phone on desktop and goes full-screen on mobile widths.

## 🗂️ Structure

```
src/
  app/
    onboarding/        taste quiz
    feed/              For You reels
    search/            search → reel feed
    assistant/         AI concierge chat
    profile/           Been / Want-to-try / taste
    restaurant/[id]/   detail + ranking
    api/assistant/     Claude (or local) recommender endpoint
  components/          ReelCard, ReelFeed, ActionRail, RankModal, BottomNav…
  lib/
    recommend.ts       explainable scoring engine + NL query parser
    ranking.ts         Beli-style pairwise comparison ranking
    store.ts           Zustand store (persisted)
    data.ts            mock restaurants + reels
```

## 📝 Notes & strategic direction

This is an MVP with a curated mock dataset. The reel posters use Unsplash and gracefully fall back to a cuisine-keyed gradient + emoji, so the UI always looks good — even offline.

The deliberate bet is **anti-mainstream discovery** rather than "another video feed." That reframes the go-to-market around problems that are actually tractable for a small team:

- **Useful at N=1** — the taste engine + concierge work for a single user with zero network, unlike a content feed that needs supply on day one.
- **Niche beachhead** — launch one city / one underserved community (e.g. a city's true hole-in-the-walls, or allergen-safe gems) where coverage is achievable and the "found it first" status compounds.
- **Curation over creation** — you need ~50 great spots per city from trusted locals, not a billion videos.

Natural next steps toward production: a real backend + accounts (move `recommend()` to a cached `/api/feed`), geolocation + a Places source for real "near me", a friends graph for social proof, transaction monetization (bookings/affiliate), and — only once supply exists — real video reels. See the in-repo review notes for the prioritized engineering backlog.
