# "Open now" concierge awareness — design

**Date:** 2026-06-20 · **Status:** Approved, in implementation

## Context

The AI concierge and the recommendation engine know a restaurant's taste fit,
neighborhood, and gem score, but nothing about **whether it's open right now**.
The Google Places ingest never requested hours, so the data simply isn't there.
This was the second half of the original two-feature idea brainstormed alongside
the Personal Map (the seams were captured in
`docs/superpowers/specs/2026-06-19-personal-map-design.md`); the Map shipped
first, this completes the pair.

When someone asks the concierge "what's good and open near me right now," it
should answer honestly with spots that are actually open, and the detail page
should show an at-a-glance open/closed state.

## Decisions (settled with the user)

- **Scope = concierge + detail line.** The shared engine (`isOpenNow` +
  time-intent parsing) feeds two surfaces: the AI concierge becomes time-aware,
  and the detail page shows an "Open now / Closed · today's hours" line. **No
  feed re-ranking** (people browse the feed for later; demoting closed spots
  there would feel wrong). **Map open-now filter is deferred** — nearly free to
  add later; the seam is noted below.
- **Full re-ingest now.** Real Google Places billing over ~1,607 spots, so the
  feature ships fully lit rather than dormant. (Adding `regularOpeningHours`
  does not bump the SKU tier — the ingest already fetches `reviews`, the top
  Enterprise+Atmosphere tier.)
- **`hours` is server-`full` only**, stripped from the client `core` dataset by
  `split-data` (like `insiderTip`/`blurb`). It's ~0.5–0.8 MB across the dataset
  and the only client surface that needs it (the detail page) already receives
  the full record from its server component.
- **Honesty over precision.** Hours come from Google and can be stale or wrong on
  holidays. Every surface that asserts open/closed carries a quiet "hours via
  Google — confirm with the spot" note. Missing hours = `unknown`, never
  penalized and never claimed open. No counts, tokens only, no dark patterns —
  consistent with the `topDishes` / deferred-DB honesty pattern.

## Architecture

### 1. Data shape

A new optional field on `Restaurant`:

```ts
interface OpeningHours {
  // Normalized intervals. Minutes-from-midnight in the venue's local time.
  // Overnight periods have closeDay !== openDay (e.g. Fri 18:00 → Sat 02:00).
  // A 24h venue is a single period with no close (open all week).
  periods: { openDay: number; openMin: number; closeDay: number; closeMin: number }[];
  weekdayText: string[];     // Google's `weekdayDescriptions`, for display
  utcOffsetMinutes: number;  // the venue's own UTC offset
}
// Restaurant.hours?: OpeningHours   (optional; absent pre-ingest)
```

Day numbering follows Google: **0 = Sunday … 6 = Saturday**.

### 2. Pure engine — `src/lib/hours.ts` (new, client-safe)

```ts
type OpenState = "open" | "closed" | "unknown";
function isOpenNow(hours: OpeningHours | undefined, nowMs: number): OpenState;
function todayHoursText(hours: OpeningHours | undefined, nowMs: number): string | null;
```

- `isOpenNow` computes the venue's local wall-clock from `nowMs +
  utcOffsetMinutes`, derives day-of-week + minutes-from-midnight, and checks each
  period — including overnight wraps (a Saturday 01:00 check matches a Friday
  18:00 → Saturday 02:00 period) and 24h venues (open period with no close).
  Returns `unknown` when `hours` is absent or has no periods.
- `todayHoursText` returns the `weekdayText` entry for the venue-local day (for
  the detail line), or `null` when unavailable.
- Pure and dependency-free. Unit-tested in `scripts/hours.check.ts`
  (`node:assert`, the existing `*.check.ts` convention — not wired to npm,
  consistent with `derive.check.ts`). Cases: mid-period open, before open, after
  close, overnight wrap, 24h, missing hours, and UTC-offset correctness.

### 3. Recommendation layer — `src/lib/recommend.ts`

- **`parseQuery()`** gains time-intent: `/(open|still open) (now|right now|late)/`,
  `/what'?s open/`, `/open (now|right now)/` → sets `openNow: true` on the parse
  result (a query-time intent like `nearMe`, **not** a `TasteProfile` field).
- **`mergeCravings()`** carries `openNow` last-wins (tied to the current moment,
  like `nearMe` — a later non-temporal turn clears it).
- **`SignalState`** gains `openNow?: boolean` and `nowMs?: number`. When
  `openNow` is set, `scoreRestaurant` adds a step:
  - `isOpenNow(r.hours, nowMs)` → **open**: `+30`, reason `"Open now"`.
  - **closed**: `-40` (strong demote, but never removed — the engine never
    empties the pool, and hours can be stale).
  - **unknown**: no change (missing data is not penalized).
- The step is **inert on the client**: `core` records have no `hours`, and only
  the concierge path sets `openNow`/`nowMs`, so the feed and detail-page
  re-scoring are unaffected.

### 4. Concierge — `src/app/api/assistant/route.ts` + `src/app/assistant/page.tsx`

- The client sends `userTime: Date.now()` in the request body (always — cheap,
  lets the server decide).
- The route's `Body` gains `userTime?: number`. After `mergeCravings`, when
  `parsed.openNow` is set it threads `openNow: true, nowMs: userTime` into the
  `recommend()` `SignalState`, so the candidate pool prefers open spots.
- Each compact candidate sent to Claude gains `openNow` (the `OpenState`) and
  `todayHours`. The system prompt gains a clause: when the user asked for
  open-now, prefer candidates marked `open`, name a closed one only if nothing's
  open, and **always** append "I'm going by Google's hours, confirm with the
  spot before heading out."
- The keyless local fallback already prefers open via the scorer; it appends the
  same caveat line when `openNow` is set.
- **Degradation:** if every candidate is `unknown` (e.g. pre-ingest), the
  concierge still answers but the caveat makes the uncertainty explicit; it never
  fabricates an open/closed claim.

### 5. Detail line — `src/components/RestaurantDetail.tsx`

A small client `OpenNowLine` near the header: `● Open now` / `○ Closed` +
`todayHoursText`, with a muted "Hours via Google" provenance note. It renders
**nothing** when `hours` is absent (like `UserDistance`), and reads `Date.now()`
inside `useEffect` after mount so the server-rendered HTML and the client agree
(no hydration mismatch, and no stale server-time open/closed). Semantic tokens
only — `gem`/`olive` for open, `ink-faint` for closed; text glyphs, no emoji.

### 6. Ingest + invariants

- **`scripts/places.ts`** — add `places.regularOpeningHours` and
  `places.utcOffsetMinutes` to `FIELD_MASK`; extend `RawPlace` with
  `regularOpeningHours?` (periods + weekdayDescriptions) and `utcOffsetMinutes?`.
- **`scripts/derive.ts`** — `hoursFrom(raw): OpeningHours | undefined` mapping
  Google's `periods` (each `{ open:{day,hour,minute}, close?:{day,hour,minute} }`)
  into the normalized shape, preserving `weekdayDescriptions` and the offset,
  handling the 24h (no-close) and missing cases. Covered by `derive.check.ts`.
- **`scripts/ingest.ts`** — attach `hours` to each derived record.
- **`scripts/split-data.ts`** — strip `hours` from `core` (add to the existing
  strip list alongside `insiderTip`/`blurb`).
- **`scripts/validate-data.ts`** — when `hours` is present, assert its shape
  (`periods` array, `utcOffsetMinutes` number, `weekdayText` array). Stays
  optional so a pre-ingest dataset still validates.
- Run `rm -rf scripts/.ingest-cache && npm run ingest` for the real refetch (the
  cache is keyed by placeId and would otherwise reuse hours-less responses).

## Design-system guardrails

Semantic tokens only; no emoji (text glyphs `● ○ ◷` are fine); honest provenance
("hours via Google") wherever open/closed is asserted; no counts; no dark
patterns. The recommendation engine is **not** hard-filtered by hours — open-now
is a strong steer, never a wall, matching the neighborhood-steer philosophy.

## Verification

- `npm run typecheck && npm run build` both clean.
- `npx tsx scripts/hours.check.ts` and `scripts/derive.check.ts` pass.
- `npm run validate-data` passes on the re-ingested dataset; spot-check that
  `hours` is populated on the full dataset and absent from `core`.
- 375px manual pass: detail page shows the open/closed line with today's hours;
  a concierge "what's good and open near me right now" query returns open spots
  with the Google-hours caveat.

## Future (seams, not built here)

- **Map open-now filter** — would need a compact open-now signal in `core` (or a
  precomputed per-spot state); deferred per the scope decision.
- **"Opens at / closes at" copy** — `isOpenNow` could be extended to a
  next-transition time for richer concierge/detail phrasing. YAGNI for v1.
