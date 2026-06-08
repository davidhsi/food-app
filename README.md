# 🍴 ReelEats

A **Beli-style restaurant discovery app built around a Reels feed and an AI recommendation engine.** Everything you do — your "For You" feed, search, and the AI concierge — surfaces restaurants as full-screen vertical reels, ranked for *your* taste.

> MVP built with Next.js 14 (App Router) + TypeScript + Tailwind + Zustand.

## ✨ What it does

| Feature | Description |
| --- | --- |
| **Onboarding** | A quick taste quiz (cuisines, vibes, dietary needs, spice + adventurousness dials, price) builds your **taste profile**. |
| **For You feed** | A TikTok/Reels-style vertical, scroll-snapping feed of restaurant reels. Each reel shows a **% match** badge and explainable **"why recommended"** chips. |
| **Search** | Search by dish, vibe, neighborhood, or plain English ("spicy ramen late night"). Results render *as a reel feed*, re-ranked to your taste. |
| **AI Concierge** | Chat in natural language ("date night, not too loud") and get matched restaurants with a friendly explanation. Powered by **Claude** when an API key is set, with a deterministic local fallback. |
| **Beli-style ranking** | Mark a place as "been" and rank it through **pairwise comparisons** (binary-search insertion) → a personal 0–10 leaderboard. |
| **Profile** | Your **Been** leaderboard, **Want to try** saves, liked spots, and editable taste profile. |

Everything persists locally (Zustand + `localStorage`), and your likes / saves / rankings **feed back into the recommendation engine** — the more you use it, the better the feed gets.

## 🧠 The recommendation engine

`src/lib/recommend.ts` is a content-based recommender with an **explainability layer**. Each restaurant is scored against:

1. Declared taste profile — cuisine, price, vibe, dietary (near-hard constraint), spice
2. **Adventurousness** — rewards novel cuisines for explorers
3. Base quality — community score + popularity
4. **Implicit affinity** — an interaction vector learned from what you've liked, saved, and ranked highly (content-based collaborative signal)
5. Proximity + novelty damping (down-ranks already-seen reels)

Every component emits a human-readable reason, so the feed can tell you *why* a spot showed up.

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

## 📝 Notes & next steps

This is an MVP with a curated mock dataset. Natural extensions: real video reels + creator uploads, live geolocation, a Places/maps backend, social graph (friends' rankings), and persisting profiles server-side. The reel posters use Unsplash and gracefully fall back to a cuisine-keyed gradient + emoji, so the UI always looks good — even offline.
