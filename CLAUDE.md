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
npm run ingest         # regenerate src/lib/restaurants.generated.json from Google Places
                       # (needs GOOGLE_PLACES_API_KEY in .env; ANTHROPIC_API_KEY optional).
                       # Add `-- --sample` for an offline 2-record run from the fixture.
npm run validate-data  # assert invariants on the generated dataset
```

**There is no test runner** (no jest/vitest, by design — this is a presentation-heavy app over deterministic logic). The verification gate for any change is: `npm run typecheck && npm run build`, plus targeted `grep` for regressions and a manual visual pass at a 375px viewport. Do not add a test framework unless asked.

## Architecture (the big picture)

The app is almost entirely **client-side**. There is no database and no auth. Restaurant data is a **generated, committed JSON dataset** (real Chicago spots from the Google Places API — see Data pipeline below); all user state lives in the browser.

- **`src/lib/data.ts`** — exports `RESTAURANTS` by importing the generated `src/lib/restaurants.generated.json` (the single source of truth for content), plus the `getRestaurant`/`ALL_CUISINES` helpers consumers rely on. **Do not hand-edit the JSON — regenerate it with `npm run ingest`.** Each `Restaurant` carries `rating` (Google stars ×2), `popularity`, `buzz` (mainstream awareness), `lat`/`lng`, `insiderTip`, and `reels[]` (only `reels[0].poster` — a `/api/photo?ref=…` proxy URL — is used by the UI; the video/emoji/gradient reel fields are legacy, not rendered).
- **`src/lib/types.ts`** — domain types plus `gemScore(r) = (rating/10) * (1 - buzz)`. **Low `buzz` = hidden gem.** This score drives the feed, search, and badges. Anything claiming "earliness"/"under the radar" derives from `buzz` — there is no historical save-count data, so never imply live counts.
- **`src/lib/recommend.ts`** — the core. `recommend(state)` and `scoreRestaurant(r, state)` are a content-based, **explainable** scorer: every signal pushes a human-readable `reason`. State is `{ profile, liked, saved, ranked, seen, neighborhood, neighborhoodStrict }`. `parseQuery()` is the NL search/assistant parser — it also extracts a **neighborhood** name from the query (matched against the dataset's real neighborhoods). Both the search page and the AI concierge feed that into the scorer: a named area gets a **strong steer** (`neighborhoodStrict`, +40 in-area + a mild out-of-area demotion) vs. the feed's gentle ambient nudge; it's never a hard filter, so a thin area falls back to the closest nearby spots rather than emptying. This is the product's brain — keep it intact; redesign work is presentation only.
- **`src/lib/ranking.ts`** — Beli-style pairwise-comparison ranking (binary-search insertion) used by `RankModal` to place a "been" spot on the 0–10 leaderboard.
- **`src/lib/store.ts`** — Zustand store persisted to `localStorage` under key `truffle-store`. Holds `profile, liked, saved, ranked, seen, onboarded`. User interactions feed back into `recommend()`, so the feed personalizes over time.
- **`src/components/AppShell.tsx`** — wraps every screen in a phone frame, gates on `onboarded` (redirects to `/onboarding`), and renders `BottomNav`. Pages opt out of nav via props.
- **Feed model:** the feed is an **editorial list of one `SpotCard` per restaurant** (not per reel). `SpotCard` is deliberately minimal (photo · gem score · name · one metadata line · save). **All depth lives on the detail page** (`src/app/restaurant/[id]/page.tsx`): the "why you" reasons (recomputed via `scoreRestaurant`), insider tip, earliness cue, and full actions including `ShareSpot`. Preserve this progressive-disclosure split — do not re-clutter the card.
- **AI concierge** (`src/app/api/assistant/route.ts`) — builds a candidate pool with the local engine, then calls Claude **if `ANTHROPIC_API_KEY` is set** (`ANTHROPIC_MODEL` optional), else returns a deterministic local result. The feature must always work without a key. A best-effort per-IP rate limit (15/min, in-memory → per-instance under Fluid Compute) caps Claude spend; returns 429 with a friendly `reply`.
- **Photo proxy** (`src/app/api/photo/route.ts`) — server-only route (`runtime = "nodejs"`) that streams a Google Places photo using `GOOGLE_PLACES_API_KEY`; the key is **never** client-exposed. Generated posters point at `/api/photo?ref=<encoded photoName>`; responses are hard-cached.
- **Dynamic distance** — restaurants store `lat`/`lng`; `src/components/UserDistance.tsx` (client) shows live distance from browser geolocation on the detail page, falling back to just the neighborhood. The static `distanceKm` (distance from the Loop) is kept only so `recommend.ts`'s proximity nudge stays unchanged — never surface it as a real user distance.
- **Launch surfaces** (added 2026-06-19; design: `docs/superpowers/specs/2026-06-19-launch-hardening-design.md`) — **Analytics:** `src/lib/analytics.ts` is a typed `track()` over Vercel Analytics; use it for new funnel events (don't call `@vercel/analytics` directly), and keep the `AnalyticsEvent` union authoritative. `<Analytics/>`+`<SpeedInsights/>` live in `layout.tsx`. **Errors:** `error.tsx`/`global-error.tsx`/`not-found.tsx` are branded; the detail route uses `notFound()` for bad IDs. **SEO/OG:** the detail route is split into a server `page.tsx` (`generateMetadata`) + client `RestaurantDetail.tsx`; `opengraph-image.tsx` renders a per-restaurant card with the real photo (inlined as a data URI). `src/lib/site.ts` holds `SITE_URL` — set `NEXT_PUBLIC_SITE_URL` in prod for canonical/OG URLs.

## Data pipeline (regenerating restaurant data)

`scripts/ingest.ts` (run via `npm run ingest`, **never** during build) pulls restaurants from the Google Places API (New) across the neighborhoods in `scripts/neighborhoods.ts` — each runs a generic "restaurants in X" query plus cuisine-targeted probes (`neighborhoodQueries()` × `CUISINE_PROBES`) to surface the long tail a generic search caps out before reaching; overlapping results are deduped by placeId. It then derives domain fields (`scripts/derive.ts` — incl. `buzz` = min-max normalized `log(reviewCount)` across the city, and `cuisinesFromTypes`), generates editorial copy **and** cuisines with Claude Haiku (`scripts/editorial.ts`; preferred over the type-derived cuisine, and it falls back to a deterministic template without `ANTHROPIC_API_KEY`), caches by placeId (`scripts/cache.ts`), and writes `src/lib/restaurants.generated.json`. `scripts/validate-data.ts` then asserts invariants.

- **Keys** live in `.env` (gitignored, never committed): `GOOGLE_PLACES_API_KEY` (required) + `ANTHROPIC_API_KEY` (optional). On Vercel they're set as Production env vars. To regenerate editorial, `rm -rf scripts/.ingest-cache` first — it's keyed by placeId and silently reuses stale copy otherwise.
- **`scripts/` must stay CommonJS** — do NOT add `scripts/package.json` with `"type":"module"`. Under tsx + Node 25 an ESM script can't named-import from a `src/` `.ts` (CJS-default) file ("does not provide an export named X"), which breaks the whole `scripts/ → ../src/lib/*` import chain.
- **Verifying scripts:** use committed-then-deleted static-import `.ts` probes run via `npx tsx scripts/<x>.ts`. Do NOT verify with `npx tsx -e "import('./...')"` — dynamic import wraps named exports under CJS and gives false failures.
- `scripts/*.check.ts` are `node:assert`-based checks for the pure logic (`npx tsx scripts/derive.check.ts`, `editorial.check.ts`); they are not wired into an npm script, consistent with the no-test-runner convention.

## Design system & conventions (enforced)

The look is **"Warm Editorial"** — calm/curated, intentionally NOT a doomscroll, casino, or dating-swipe app. When editing UI, follow these (they are actively swept for):

- **Semantic color tokens only, no raw hex in components.** Tokens in `tailwind.config.ts`: `paper`, `paper-raised`, `ink`, `ink-soft`, `ink-faint`, `olive`, `olive-deep`, `line`, `gem`. (The old dark `text-white/*`, `bg-white/*`, `bg-zinc`, `brand` classes are gone — don't reintroduce them.)
- **Fonts:** `font-display` = Fraunces, `font-sans` = Inter, loaded via `next/font/google` in `layout.tsx`. Headings use `font-display font-semibold` (not `font-black`).
- **No emoji as UI.** Use the SVG icon family in `src/components/icons.tsx`. Text glyphs `◆ ★ ◷ ·` are acceptable accents; pictographic emoji (💎 🔥 ✨ faces) are not. Emoji inside `.replace()` regexes (stripping them out of data labels) are fine.
- **Images:** SpotCard / detail / RankModal / profile use a raw `<img>` with `// eslint-disable-next-line @next/next/no-img-element`. Real photos are served **same-origin** via the `/api/photo` proxy (so they need no `remotePatterns` entry); `next.config.mjs` still whitelists `images.unsplash.com` for any legacy/stock use.
- **No dark patterns:** no autoplay, no infinite supply (show a "you're caught up" end state), no streaks, no slot-machine/spinner mechanics. "Help me decide" must stay a single deterministic pick, never a roulette.
- Respect `prefers-reduced-motion` (handled globally in `globals.css`); keep motion quiet (`animate-floatUp`).
- Don't use "reel"/"reels" in user-facing copy (retired concept); `.reels[]` property access in code is fine.

## Process docs

Design rationale and the feed-mechanic decision are in `docs/superpowers/specs/`; the task-by-task build breakdown is in `docs/superpowers/plans/`. The real-data migration is `specs/2026-06-14-real-data-ingestion-design.md` + `plans/2026-06-14-real-data-ingestion.md`. Deferred-by-design work (named there, not yet built): a finite taste-trainer calibration deck, a one-spot focus reader, real backend-backed earliness receipts, and dark mode.
