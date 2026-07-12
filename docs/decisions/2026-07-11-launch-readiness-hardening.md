# 2026-07-11 — Launch-readiness hardening over new features

Status: Shipped

## Context

A deliberate fresh-eyes review (three independent audits — product surface, codebase
health, strategy/docs — plus a live walkthrough of the deployed app) asked: "as an
unbiased new CEO, what should this product do next?" The verdict: the craft is real and
the thesis is coherent, but the product is **pre-user and pre-signal** — analytics
events are defined but no funnel has ever accrued, there's no distribution, and every
growth belief in the docs is untested assertion. The next unit of progress is
real-user signal, not another feature.

## Decision

**Stop feature work; make the app safe, honest, and actionable enough to put in front
of ~20 real Chicago users, then read the funnel before deciding anything else.**

Shipped in this pass (see the timeline entry for the mechanics): delete the orphaned
`/api/order` route; rate-limit `/api/photo`; version the persisted store; treat
empty-ref posters as missing (`posterUrl()`); add a Directions outbound link on the
detail page; and a copy honesty pass.

## The non-obvious calls (and rejected alternatives)

- **"Only about X% of people have found it" → removed, not reworded into a number.**
  The number was `buzz * 100` — a static derived field dressed as live crowd data,
  contradicting the product's own no-implied-counts rule. Rejected: keeping the figure
  with a footnote (a footnote doesn't fix a fabricated-feeling stat), and building real
  earliness receipts (needs a backend; explicitly deferred elsewhere).
- **Directions = an outbound Google Maps *place search* link, not in-app
  directions/booking, and not a re-ingest for `websiteUri`/phone.** The place listing
  gives directions, phone, menu, and booking in one tap with zero new data or API cost.
  A re-ingest to carry website/phone fields is still worthwhile but is bundled into the
  next scheduled ingest (it refreshes stale hours at the same time), not done as its
  own pass. Rejected: keeping the page outbound-free to "keep users in the app" — a
  discovery app that won't let you act on a discovery fails its core job, and the calm
  ethos explicitly isn't an engagement-trap ethos.
- **Photo-proxy limit is the same best-effort in-memory limiter as the assistant's
  (extracted to `ratelimit.server.ts`), not Upstash/WAF.** Per-instance limiting is
  imperfect under Fluid Compute scale-out, but the marginal risk at pre-launch traffic
  doesn't justify new infrastructure; the param whitelist (only `ref`) already kills
  the cheap cache-busting vector. The ROADMAP's existing "Upstash if abuse warrants"
  trigger stands.
- **`/api/order` deleted rather than kept-but-gated.** The deferred "Option B" (live
  Claude upgrade with locked pick order) in the 2026-06-21 decision record remains
  possible — the engine lives in `lib/order*`, so the route is trivially recreatable;
  an unauthenticated deployed endpoint is not a cheap way to keep an option open.

## What this explicitly defers

Multi-city, database/accounts, native app/PWA, monetization, richer concierge — all
premature before any real-user signal (consistent with the DB-trigger framework in
`planning/2026-06-17-data-storage-db-assessment.md`). The remaining launch steps are
operational, not code: a fresh `npm run ingest` (hours are ~3 weeks stale), a custom
domain, and actually sharing the app.
