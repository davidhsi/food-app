# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Truffle** — a calm, editorial discovery app for under-the-radar restaurants (Next.js 14 App Router + TypeScript + Tailwind + Zustand). It surfaces high-quality, low-buzz "hidden gems" ranked for the user's taste. It was rebranded and redesigned from a prior dark, TikTok-style "ReelEats" reels feed; that surface is fully retired (see `docs/superpowers/specs/2026-06-13-truffle-redesign-design.md`).

## Commands

```bash
npm run dev        # local dev at http://localhost:3000
npm run build      # production build (this is a primary correctness gate)
npm run start      # serve the production build
npm run typecheck  # tsc --noEmit (strict)
npm run lint       # next lint
```

**There is no test runner** (no jest/vitest, by design — this is a presentation-heavy app over deterministic logic). The verification gate for any change is: `npm run typecheck && npm run build`, plus targeted `grep` for regressions and a manual visual pass at a 375px viewport. Do not add a test framework unless asked.

## Architecture (the big picture)

The app is almost entirely **client-side**. There is no database and no auth. All restaurant data is a static mock array; all user state lives in the browser.

- **`src/lib/data.ts`** — the static `RESTAURANTS` dataset (the single source of truth for content). Each `Restaurant` carries `rating`, `popularity`, `buzz` (mainstream awareness), `insiderTip`, and `reels[]` (only `reels[0].poster` — an Unsplash image — is used by the UI now; the video/emoji/gradient reel fields are legacy data, not rendered).
- **`src/lib/types.ts`** — domain types plus `gemScore(r) = (rating/10) * (1 - buzz)`. **Low `buzz` = hidden gem.** This score drives the feed, search, and badges. Anything claiming "earliness"/"under the radar" derives from `buzz` — there is no historical save-count data, so never imply live counts.
- **`src/lib/recommend.ts`** — the core. `recommend(state)` and `scoreRestaurant(r, state)` are a content-based, **explainable** scorer: every signal pushes a human-readable `reason`. State is `{ profile, liked, saved, ranked, seen }`. `parseQuery()` is the NL search/assistant parser. This is the product's brain — keep it intact; redesign work is presentation only.
- **`src/lib/ranking.ts`** — Beli-style pairwise-comparison ranking (binary-search insertion) used by `RankModal` to place a "been" spot on the 0–10 leaderboard.
- **`src/lib/store.ts`** — Zustand store persisted to `localStorage` under key `truffle-store`. Holds `profile, liked, saved, ranked, seen, onboarded`. User interactions feed back into `recommend()`, so the feed personalizes over time.
- **`src/components/AppShell.tsx`** — wraps every screen in a phone frame, gates on `onboarded` (redirects to `/onboarding`), and renders `BottomNav`. Pages opt out of nav via props.
- **Feed model:** the feed is an **editorial list of one `SpotCard` per restaurant** (not per reel). `SpotCard` is deliberately minimal (photo · gem score · name · one metadata line · save). **All depth lives on the detail page** (`src/app/restaurant/[id]/page.tsx`): the "why you" reasons (recomputed via `scoreRestaurant`), insider tip, earliness cue, and full actions including `ShareSpot`. Preserve this progressive-disclosure split — do not re-clutter the card.
- **AI concierge** (`src/app/api/assistant/route.ts`) — the only server route. Builds a candidate pool with the local engine, then calls Claude **if `ANTHROPIC_API_KEY` is set** (`ANTHROPIC_MODEL` optional), else returns a deterministic local result. The feature must always work without a key.

## Design system & conventions (enforced)

The look is **"Warm Editorial"** — calm/curated, intentionally NOT a doomscroll, casino, or dating-swipe app. When editing UI, follow these (they are actively swept for):

- **Semantic color tokens only, no raw hex in components.** Tokens in `tailwind.config.ts`: `paper`, `paper-raised`, `ink`, `ink-soft`, `ink-faint`, `olive`, `olive-deep`, `line`, `gem`. (The old dark `text-white/*`, `bg-white/*`, `bg-zinc`, `brand` classes are gone — don't reintroduce them.)
- **Fonts:** `font-display` = Fraunces, `font-sans` = Inter, loaded via `next/font/google` in `layout.tsx`. Headings use `font-display font-semibold` (not `font-black`).
- **No emoji as UI.** Use the SVG icon family in `src/components/icons.tsx`. Text glyphs `◆ ★ ◷ ·` are acceptable accents; pictographic emoji (💎 🔥 ✨ faces) are not. Emoji inside `.replace()` regexes (stripping them out of data labels) are fine.
- **Images:** SpotCard / detail / RankModal use a raw `<img>` with `// eslint-disable-next-line @next/next/no-img-element` for remote Unsplash URLs; profile uses `next/image`. Both work because `next.config.mjs` whitelists `images.unsplash.com` in `remotePatterns`.
- **No dark patterns:** no autoplay, no infinite supply (show a "you're caught up" end state), no streaks, no slot-machine/spinner mechanics. "Help me decide" must stay a single deterministic pick, never a roulette.
- Respect `prefers-reduced-motion` (handled globally in `globals.css`); keep motion quiet (`animate-floatUp`).
- Don't use "reel"/"reels" in user-facing copy (retired concept); `.reels[]` property access in code is fine.

## Process docs

Design rationale and the feed-mechanic decision are in `docs/superpowers/specs/`; the task-by-task build breakdown is in `docs/superpowers/plans/`. Deferred-by-design work (named there, not yet built): a finite taste-trainer calibration deck, a one-spot focus reader, real backend-backed earliness receipts, and dark mode.
