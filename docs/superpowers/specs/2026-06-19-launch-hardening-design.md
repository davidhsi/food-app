# Launch hardening — design & decisions

**Date:** 2026-06-19
**Status:** Shipped (built this session)
**Roadmap item:** Pre-launch hardening (see `docs/ROADMAP.md`)

## Problem

A reviewer pass found Truffle **feature-complete and buildable**, but thin on the
operational/polish layer that a public launch needs. The product loop (feed,
search, AI concierge, ranking, profile) works end to end; what was missing was
everything around it: no analytics, no error/404 surfaces, generic share
previews, an unmetered AI endpoint, and patchy accessibility. None were
showstoppers individually; together they were the gap between "demo" and
"launchable." This session closed that gap.

The scope was deliberately **launch-hardening, not new features** — chosen over
building deferred roadmap features (taste-trainer, focus reader) or a data
rebalance, because observability + safety + shareability are what make a launch
measurable and safe rather than just bigger.

## Goals

- **Observability** — know what users do post-launch (funnels, drop-off,
  feature adoption) and how fast pages are.
- **Graceful failure** — no blank screens; corrupted state or bad URLs land on a
  branded, recoverable surface.
- **Shareability** — shared restaurant links produce rich, appetizing previews
  (the growth loop).
- **Cost/abuse safety** — the Claude-backed endpoint can't be spammed into a
  cost overrun.
- **Accessibility** — interactive elements are labeled for screen readers.

## Non-goals (parked)

- New product features (taste-trainer deck, focus reader, "Not for me" signal).
- Data coverage rebalance across neighborhoods.
- A real product-analytics backend with dashboards (Vercel Analytics covers v1;
  a `track()` indirection makes swapping providers cheap later).
- A hard, globally-exact rate limit (the in-memory limiter is per-instance,
  best-effort — see decision below).

## What shipped

### 1. Error handling & recovery

- `src/app/error.tsx` — route-level error boundary (client). Catches
  render/runtime errors (e.g. a corrupted persisted store) and offers
  "Try again" + "Back to feed" instead of a blank screen. Logs to console.
- `src/app/global-error.tsx` — last-resort boundary for errors thrown in the
  root layout itself. Renders its own `<html>/<body>` with **inline styles**
  (global CSS may not have loaded at that point) using the palette hexes.
- `src/app/not-found.tsx` — branded 404.
- `src/app/restaurant/[id]/page.tsx` calls `notFound()` for unknown IDs → real
  HTTP 404 (was a soft in-page message). The client fallback in
  `RestaurantDetail.tsx` also gained a "back to feed" CTA.

### 2. Analytics — Vercel Analytics + Speed Insights

- `<Analytics/>` (`@vercel/analytics/react`) and `<SpeedInsights/>`
  (`@vercel/speed-insights/next`) mounted in `src/app/layout.tsx`.
- `src/lib/analytics.ts` — a thin, **typed** `track(event, props)` wrapper over
  Vercel's `track`. Centralizing the event names keeps the funnel vocabulary
  consistent and makes swapping the sink later a one-file change. `track` is
  try/caught so analytics can never break a user interaction, and no-ops on the
  server / before the script loads.

  **Event vocabulary** (`AnalyticsEvent` union — keep this list authoritative):

  | Event | Fired from | Key props |
  |---|---|---|
  | `onboarding_complete` | `onboarding/page.tsx` | `skipped`, `cuisines`, `vibes`, `undergroundBias` |
  | `restaurant_view` | `RestaurantDetail.tsx` (mount) | `id`, `neighborhood` |
  | `save_toggle` | `SpotCard.tsx`, `RestaurantDetail.tsx` | `id`, `saved`, `source` (`card`\|`detail`) |
  | `like_toggle` | `RestaurantDetail.tsx` | `id`, `liked` |
  | `rank_complete` | `RankModal.tsx` | `id`, `listSize` |
  | `share_spot` | `ShareSpot.tsx` | `id`, `method` (`web_share`\|`clipboard`) |
  | `search_submit` | `search/page.tsx` | `query` (truncated 80) |
  | `assistant_query` | `assistant/page.tsx` | `length` |
  | `help_me_decide` | `HelpMeDecide.tsx` | `id` |
  | `neighborhood_select` | `NeighborhoodChips.tsx` | `neighborhood` (user taps only, not the silent geo pre-select) |

### 3. SEO + per-restaurant OG images

- The detail route's server `page.tsx` exports `generateMetadata` alongside the
  page. (It became a server component in the data-split work — it loads the full
  record via `getFullRestaurant` and renders the client
  `src/components/RestaurantDetail.tsx`; `generateMetadata` reuses
  `getFullRestaurant` so it can read the `insiderTip`.) The route stays dynamic
  (`ƒ`) — no `generateStaticParams`, so we don't prerender 1,600+ pages.
- `src/lib/site.ts` — canonical `SITE_URL` (prefers `NEXT_PUBLIC_SITE_URL`, then
  `VERCEL_URL`, then localhost), `SITE_NAME`, `SITE_TAGLINE`. Used for
  `metadataBase` and OG absolute URLs.
- `src/app/layout.tsx` — added `metadataBase`, a title template
  (`%s · Truffle`), and openGraph/twitter defaults.
- `generateMetadata` produces a per-restaurant title and a description built from
  the **insider tip** (falls back to a gem-score line).
- `src/app/restaurant/[id]/opengraph-image.tsx` — a 1200×630 card via
  `next/og` `ImageResponse`: the **real food photo** as background, a legibility
  scrim, the "Truffle." wordmark, a gem-score badge, cuisines · price ·
  neighborhood, and an olive accent bar. `runtime = "nodejs"`. Next auto-attaches
  this route to the page's OG metadata.

### 4. Rate limiting — `src/app/api/assistant/route.ts`

A best-effort per-IP fixed-window limiter (15 req/min) gating the Claude call.
Returns HTTP 429 with a friendly `reply` (so the chat UI shows it gracefully) and
a `retry-after` header. Memory is bounded by sweeping expired windows past 5,000
entries.

### 5. Accessibility pass

- `search/page.tsx` — `role="search"`, `type="search"`, `aria-label` on input,
  `aria-label` on clear button.
- `assistant/page.tsx` — `aria-label` + `enterKeyHint="send"` on the chat input,
  `aria-label="Send"` on the submit button.
- `aria-pressed` on save/like toggles (`SpotCard`, `RestaurantDetail`) and the
  neighborhood chips; `aria-label` on the neighborhood filter group.

## Key decisions

- **Analytics provider = Vercel Analytics + Speed Insights** (over PostHog or a
  custom layer). Native, zero-config on Vercel, privacy-friendly; the `track()`
  indirection in `src/lib/analytics.ts` keeps a richer provider a cheap swap.
- **OG scope = full per-restaurant images** (over text-only metadata). The food
  photo is the appetizing hook that makes a shared link convert.
- **OG photo is fetched server-side and inlined as a data URI** rather than
  passing the proxy/Google URL to satori. Satori following a redirect can flake;
  inlining the bytes is robust. Falls back to a branded card if the photo or
  `GOOGLE_PLACES_API_KEY` is missing.
- **The `◆` brand diamond is a CSS-rotated square in the OG card**, not the glyph
  — satori's default font renders `◆` as tofu.
- **Rate limit is per-instance, not global.** Under Fluid Compute each instance
  has its own `Map`, so the effective limit is `15 × instances`/min. That's
  enough to cap accidental/abusive spend for launch; a hard global limit would
  need a shared store (Upstash Redis) — noted as the upgrade path in code.
- **Onboarding skip was kept, not gated.** The "Skip for now" affordance is a
  deliberate product choice; the recommender handles an empty profile (defaults
  `undergroundBias` 0.7). We instrumented completion with a `skipped` flag
  instead of blocking it.

## Deploy-time configuration

- **`NEXT_PUBLIC_SITE_URL`** — set to the canonical custom domain
  (e.g. `https://truffle.app`) as a Production env var. Without it, OG/canonical
  URLs fall back to the per-deployment `VERCEL_URL`, which works but isn't the
  branded host.
- **Vercel Analytics / Speed Insights** — no config; they activate on deploy.
- Existing keys unchanged: `GOOGLE_PLACES_API_KEY` (required; also used by the OG
  route to fetch the photo), `ANTHROPIC_API_KEY` (optional).

## Verification

- `npm run typecheck` — clean.
- `npm run build` — clean; route table shows the new
  `/restaurant/[id]/opengraph-image` and `/_not-found`, and `/restaurant/[id]`
  as server-rendered (`ƒ`).
- Live (`npm run start`): OG endpoint → `200 image/png`, 1200×630, real photo
  embedded; detail page HTML → per-restaurant `og:title` / `og:description` /
  `og:image`; unknown ID → HTTP `404`.
- Visual check of the rendered OG card (wordmark, drawn diamond, photo, accent
  bar).

## Follow-ups (not done this session)

- Hard global rate limit via a shared store (Upstash Redis) if needed.
- Per-neighborhood data coverage rebalance (Logan Square ~20% vs Greektown ~2%).
- "Not for me" negative-feedback signal on the detail page.
- A real product-analytics dashboard / funnel definitions once events accrue.
- Keyboard-navigation audit beyond labeling.
