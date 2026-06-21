# "Open now" concierge awareness — hours as an honest steer

**Status:** Shipped (2026-06-20)

## Problem & goal

The concierge and recommendation engine knew taste fit, neighborhood, and gem
score, but nothing about whether a spot was **open right now** — the Places
ingest never requested hours. This completes the two-feature idea brainstormed
alongside the Personal Map: let someone ask "what's good and open near me right
now" and get an honest answer, and show an at-a-glance open/closed state on the
detail page.

## What shipped

A real Google Places re-ingest added `regularOpeningHours` + `utcOffsetMinutes`
to the field mask, derived at ingest into a normalized `OpeningHours`
(`scripts/derive.ts` `hoursFrom`). A pure, client-safe `src/lib/hours.ts`
(`isOpenNow`, `todayHoursText`) judges open/closed against each venue's own UTC
offset. `parseQuery()` gained time-intent; `scoreRestaurant` boosts open /
demotes closed when the concierge sets `openNow` + `nowMs`. `/api/assistant`
threads open/closed + a Google-hours caveat into both the Claude prompt and the
keyless local reply; the detail page shows a `● Open now / ○ Closed · hours`
line. Spec + plan: `docs/superpowers/{specs,plans}/2026-06-20-open-now-concierge*`.

## Key decisions & rationale

- **Open-now is a strong steer, never a hard filter.** *Rejected:* dropping
  closed spots from results. Google hours can be stale or wrong on holidays, and
  the engine's whole philosophy is "never empty the pool" (mirrors the
  neighborhood steer). So open gets +30, closed gets −40 (demoted, not removed),
  and **unknown hours are never penalized and never claimed open** — missing data
  shouldn't bury a great spot or fabricate certainty.
- **Honesty caveat everywhere hours surface.** Every open/closed assertion
  carries "going by Google's hours, confirm with the spot." Consistent with the
  `topDishes` / no-counts honesty pattern — we never imply a precision we don't
  have.
- **`hours` lives in the server `full` dataset only**, stripped from client
  `core` by `split-data` (like `insiderTip`/`blurb`). *Rejected:* shipping it in
  `core`. It's ~0.5–0.8 MB across ~1.6k spots, and the only client surface that
  needs it (the detail page) already receives the full record from its server
  component; the concierge runs server-side over `RESTAURANTS_FULL`. Keeping it
  out of `core` preserves the lean client bundle the data split exists to protect.
- **Per-venue UTC offset, not a global Chicago timezone.** Every spot is in
  Chicago today, but judging against each venue's own `utcOffsetMinutes` is
  correct, DST-safe, and future-proofs a multi-city dataset for free.
- **Detail line computes `now` in a `useEffect`, not at render.** The detail page
  is server-rendered then hydrated; computing open/closed during render would
  risk a server/client mismatch (and a stale server clock). Mirrors
  `UserDistance` — render nothing until the client clock is read.
- **Kept the editorial ingest cache during the re-ingest.** *Corrected the
  plan/CLAUDE.md guidance to `rm -rf scripts/.ingest-cache`:* that cache stores
  only Claude-Haiku **editorial**, keyed by placeId. The Places search (which now
  carries hours) always runs live, so hours don't depend on the cache. Busting it
  would needlessly regenerate ~1,600 blurbs (Anthropic cost + time + editorial
  churn) without changing the hours outcome.

## Deferred (seams noted in the spec)

- **Map "open now" filter** — would need a compact open-now signal in `core` (or
  precomputed per-spot state). Out of scope per the agreed concierge-+-detail
  scope; nearly free to add later.
- **"Opens at / closes at" copy** — `isOpenNow` could be extended to a
  next-transition time for richer phrasing. YAGNI for v1.
