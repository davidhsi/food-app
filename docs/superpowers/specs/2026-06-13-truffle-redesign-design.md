# Truffle — Redesign & Rebrand Design Spec

**Date:** 2026-06-13
**Status:** Approved for planning
**Supersedes:** the "ReelEats" reels-feed MVP

## Overview

Rebrand and redesign the app from **ReelEats** (a dark, TikTok-style full-bleed reels feed) into **Truffle** — a calm, premium, editorial discovery app for under-the-radar restaurants. The product thesis is unchanged: help people find hidden gems *before everyone else*. What changes is the surface and the feel.

The redesign rests on four locked decisions, each validated visually during brainstorming:

1. **Name:** Truffle — a hidden underground delicacy you have to know to find. On-theme, playful, gen-z friendly.
2. **Direction:** "Warm Editorial" — calm, curated, magazine-like. Deliberately *not* loud, not a doomscroll, not a casino, not a dating app.
3. **Feed:** a calm editorial list (vertical scroll of clean cards), with depth revealed on tap-through. Replaces the immersive reels feed.
4. **Palette + Type:** "Garden" palette (paper + ink + olive) and Fraunces (display) + Inter (body).

### Why this direction

A 5-reviewer panel (gen-z culture, retention, product/UX, market strategy, brand/ethics) evaluated candidate feed mechanics. Consensus, with scores:

- **Editorial list** (the spine) — the only mechanic that *is* the Warm Editorial brand; share-friendly, regulator-safe.
- **Tinder left/right swipe** (4.2/10) — reads as "Hinge for tacos," imports swipe-fatigue; confined to a finite, opt-in taste-trainer (deferred).
- **Slot-machine "AI spin"** (2.2/10) — gambling-adjacent UX aimed at under-27s; App Store + regulatory risk; **cut entirely**. Its good half (decide-for-me) survives as a deterministic "Help me decide" button.

The panel's load-bearing insight: **stickiness comes from the share unit and the earliness flex, not the gesture.** Put the dopamine in the content (scarcity, "only locals know," being early), keep the interaction calm.

## Brand & Naming

- App name **Truffle** everywhere user-facing; wordmark renders as `Truffle.` (Fraunces, the trailing period in olive accent).
- Rename across: `package.json` (`name`, `description`), `src/app/layout.tsx` metadata (title/description), `themeColor`, onboarding/loading wordmark, README, and any "ReelEats" string in copy.
- Tagline: "Find the spots before everyone else."

## Design System

### Palette — "Garden"

Semantic tokens (defined in `tailwind.config.ts` + CSS variables; no raw hex in components):

| Token | Value | Use |
|---|---|---|
| `paper` | `#F4F1E8` | app background, surfaces |
| `paper-raised` | `#FBF9F2` | cards, raised surfaces |
| `ink` | `#1d2014` | primary text, wordmark |
| `ink-soft` | `#5f6450` | secondary text, metadata |
| `ink-faint` | `#8c9072` | tertiary/labels |
| `olive` (accent) | `#5c6b2e` | brand accent, active states, links, gem score |
| `olive-deep` | `#445223` | accent text on light, hover |
| `line` | `#d9d6c8` | borders, dividers |
| `gem` | `#cfe08a` on `rgba(28,33,18,.72)` | gem-score badge (on photos) |

Dark mode is **out of scope for v1** (the brand is intentionally light/warm). Tokens are structured so a dark theme can be added later without touching components.

### Typography

- **Display:** Fraunces (Google Fonts, variable) — weights 500/600/900. Headings, restaurant names, wordmark, big editorial moments. Optical sizing on.
- **Body/UI:** Inter (Google Fonts) — 400/500/600. Body copy, metadata, buttons, labels.
- Loaded via `next/font/google` in `layout.tsx` (replaces the current system-font stack), exposed as `--font-display` and `--font-sans`.
- Scale: 12 / 13 / 15 / 18 / 23 / 32 / 40. Body line-height 1.5; display 1.05.

### Iconography

- **Remove all emoji used as UI** (🍴 💎 ✦ 🔥 etc.). Replace with a single SVG icon family (Lucide-style strokes at 1.75–2px), extending the existing `src/components/icons.tsx`.
- Gem score uses a simple glyph (◆) + number, not an emoji.

### Surface & motion

- One surface treatment: `paper-raised` cards with a hairline `line` border and large radius (18–22px). No glassmorphism, no stacked blur/ring/shadow.
- Motion is quiet: keep `floatUp` (subtle entrance), **remove** `kenburns` (the constant zoom is loud/doomscroll-coded). Respect `prefers-reduced-motion`. Durations 150–250ms, ease-out.
- **No** autoplay, infinite-supply illusions, or open-app streaks. Feed shows a visible "you're caught up" end state.

## Feed Architecture

### The list (`/feed`)

Replaces the snap-scroll reels feed with a calm vertical scroll of editorial cards, optionally grouped into a section header ("This week · Mission" style kicker — copy only, no new data needed).

**Card anatomy (minimal — the locked simple version):**
- Hero photo (rounded), with a single gem-score badge (◆ score) top-left and a quiet **save** (bookmark) button top-right.
- Restaurant name (Fraunces).
- One metadata line: `★ rating · cuisines · price · neighborhood`.
- Nothing else on the card. (Earlier richer variant was rejected as cluttered.)

Everything else is **progressive disclosure → tap-through detail.**

### Tap-through detail (`/restaurant/[id]`, reskinned)

The depth lives here:
- Larger hero, name, full metadata.
- **"Why you"** line — plain-language personalization from the existing recommender (`recommend.ts` reasons).
- **Insider "order like a regular" tip** — from the existing `insiderTip` field.
- **Earliness cue** — derived from existing `buzz`/`gemScore` (e.g., "Still under the radar — you'd be early"). **Not** a real historical save-count timeline (no backend); copy must not imply precise live counts.
- Actions: Save / Want-to-try, **Share**, Rank (existing `RankModal`), "Not for me" (feeds the recommender's signal).

### Components affected

| Current | Becomes |
|---|---|
| `ReelFeed.tsx` (snap-y reels) | `Feed` — editorial vertical list + "you're caught up" end state |
| `ReelCard.tsx` (full-bleed) | `SpotCard` — minimal editorial card |
| `ActionRail.tsx` (TikTok side rail) | removed; save inline on card, full actions on detail |
| `AppShell.tsx` | reskinned (paper bg, Truffle wordmark loader) |
| `BottomNav.tsx` | reskinned to Garden; labels: Feed / Search / AI / You |
| `RankModal.tsx` | reskinned to Garden |
| `icons.tsx` | extended; emoji removed |

## New in v1

### Share-a-spot card
- A one-tap action (on the card's save row and on detail) that produces a clean, single-spot share card and invokes the Web Share API (with clipboard fallback — pattern already exists in `ActionRail`).
- The shared artifact is the growth loop: photo + name + gem score + neighborhood + "found on Truffle." Implemented as a styled component; image export can be a later enhancement (v1 shares a link + rich card).

### "Help me decide"
- A single, calm button (e.g., on the Feed, "Can't decide? Truffle picks tonight") that returns **one** confident recommendation + a written reason, reusing `recommend.ts`/`ranking.ts`.
- **No spinner, no roulette, no variable-reward animation.** A brief, tasteful reveal at most.

## Screen-by-screen revamp

1. **Onboarding** — reskin to Garden/Fraunces; keep the existing taste-profile steps and chips; remove emoji; remove the slider 🔥/💎 emoji. (Taste-trainer deck is a *later* phase, not this build.)
2. **Feed** — editorial list per above.
3. **Search** — reskin; results render as the same `SpotCard` list (or a 2-col grid is acceptable here later); keep existing NL parsing + trending queries (re-copy to remove emoji where present).
4. **AI / Assistant** — reskin chat to Garden/Fraunces; restaurant results use `SpotCard`; keep `/api/assistant`.
5. **Profile ("You")** — reskin; been/want/liked tabs; replace 🍴 avatar with an SVG monogram; keep ranking logic.
6. **Restaurant detail** — the tap-through depth surface above.

## Out of scope / deferred (named, not silently dropped)

- **Taste-trainer calibration deck** (finite left/right) — phase 2.
- **Focus reader** (one-spot-per-screen swipe-up on cream) — phase 3, only after it's proven not to drift into TikTok cosplay.
- **Real earliness receipts** (historical save-count time-series) — needs a backend; v1 uses a derived "you'd be early" cue.
- **Slot-machine / spin mechanic** — cut permanently (brand + regulatory risk).
- **Dark mode** — later.
- **Video reels** — the `Reel.video`/`poster` data stays in the model but the immersive video surface is retired; cards use the poster image.

## Technical approach

- Stack unchanged: Next.js 14 App Router, Tailwind, Zustand store, static `data.ts`, single `/api/assistant` route. No new dependencies required (fonts via `next/font`).
- **Design tokens first:** update `tailwind.config.ts` (Garden colors, Fraunces/Inter families, prune `kenburns`) and `globals.css` (paper background, font variables, remove dark `#0c0c10` defaults, keep `.no-scrollbar`/snap utilities only where still used). The `.phone-shell` frame can stay for the mobile-framed presentation.
- Then rebuild components feed-first (`SpotCard`, `Feed`), then shell/nav, then the remaining screens.
- Keep all business logic (`ranking.ts`, `recommend.ts`, `feed.ts`, `store.ts`, `gemScore`) intact; this is a presentation + IA change, not a logic rewrite.

## Risks & guardrails (from the panel)

- **Don't recreate the loud app.** No black full-bleed, no kenburns, no glass-soup, no emoji icons. If it feels like TikTok, the positioning dies.
- **No dark patterns.** No autoplay/infinite/streaks; visible end state; "Help me decide" must never become a spinner.
- **Don't over-promise earliness.** Copy must match the data we actually have.
- **Keep the card calm.** Resist re-cluttering `SpotCard`; depth belongs on detail.

## Verification

- Typecheck (`tsc --noEmit`) and `next build` pass.
- Manual pass on a 375px viewport: feed scroll, card → detail, save, share (Web Share / clipboard), "Help me decide", search, assistant, profile, onboarding.
- Visual check: no emoji as icons anywhere; all colors via tokens; Fraunces/Inter loading without FOIT; reduced-motion respected.
- No remaining "ReelEats" strings (`grep -ri reeleats src`).
