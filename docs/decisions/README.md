# Design decisions

Short, durable records of **why** a non-obvious choice was made — especially the
options we *rejected* and the constraints that drove the call. They complement the
forward-looking `docs/ROADMAP.md`, the per-feature `docs/superpowers/{specs,plans}/`,
and the chronological `docs/feature-timeline.md`.

## When to add one
Write a record when a decision is hard to reverse, surprising to a newcomer, or likely
to be re-litigated — e.g. adopting/declining infrastructure, dropping a built feature,
or a choice that trades off against the product ethos. Skip it for routine
implementation.

## Format
One Markdown file per decision, named `YYYY-MM-DD-short-slug.md`, with:
**Problem & goal · What shipped · Key decisions & rationale (incl. alternatives
rejected) · Status.** Keep it scannable. Mark `Status:` (Proposed / Shipped /
Superseded by …).

## Index

| Date | Decision | Status |
|---|---|---|
| 2026-06-17 | [Data storage: no DB/warehouse yet + the future-DB seam & triggers](../../planning/2026-06-17-data-storage-db-assessment.md) | Shipped |
| 2026-06-19 | [Ordering & dish guidance — "what should I order here?" (request-time, no live voting)](./2026-06-19-ordering-and-dish-guidance.md) | Shipped |
| 2026-06-19 | [Discovery & navigation UX — search ↔ concierge, "near me", navigation state](./2026-06-19-discovery-and-navigation-ux.md) | §1 refined by Discover-home merge |
| 2026-06-19 | [Merge Feed + Search into one editorial "Discover" home](./2026-06-19-discover-home-merge.md) | Shipped |
| 2026-06-19 | [Chatbot voice — naturalness across both engines (seeded variation, no machine tells)](./2026-06-19-chatbot-voice-naturalness.md) | Shipped |
| 2026-06-19 | [Concierge conversation memory — stateless server, client-held history, merged intent](./2026-06-19-concierge-conversation-memory.md) | Shipped |
| 2026-06-19 | [Personal Map view — phone-native map of your spots + nearby gems (Leaflet + CARTO)](./2026-06-19-personal-map.md) | Shipped |

> The data-storage assessment lives under top-level `planning/` for historical
> reasons; it's the same kind of record and is indexed here for discoverability.
