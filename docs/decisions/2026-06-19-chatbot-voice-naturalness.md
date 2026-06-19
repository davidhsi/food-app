# Design decision: chatbot voice — naturalness across both engines

**Date:** 2026-06-19
**Status:** Shipped
**Author:** David Hsi (with Claude)
**Related:** `2026-06-19-ordering-and-dish-guidance.md` (the ordering engine this re-voices), `docs/feature-timeline.md`

## Problem & goal

The chatbot (the `/assistant` concierge and the "what should I order at X" guide)
answers from **two engines that are meant to be indistinguishable** but weren't:

1. A **deterministic keyless fallback** (`composeLocalReply`, `buildLocalOrderGuide`
   / `orderGuideToReply`) — ships by default, used whenever `ANTHROPIC_API_KEY` is
   unset, and was the most robotic surface.
2. A **Claude upgrade** (`askClaude`, `askClaudeOrder`) — used only when a key is set.

A staff-engineer read surfaced specific "machine tells": a literal `87% match for
your taste` in conversational copy, one fixed reply skeleton and canned tail every
time, four `tasteWhy` strings repeated **verbatim** across every dish/restaurant, a
clunky per-dish allergen line, and Claude prompts with no voice anchor and no ban on
those same tells. Goal: make both engines read like a friend who knows the city,
**without** touching the recommendation brain or breaking the calm/honest ethos.

## What shipped (presentation/voice only)

- **Deterministic-seeded variation.** A new `seededPick(pool, seed)` in `order.ts`
  (pure/client-safe, shared by both engines) chooses a phrasing from a small pool by
  hashing a stable seed (restaurant/dish id). Applied to `tasteWhy` reasons, the
  `orderGuideToReply` openers, the intro fallback, and the concierge `composeLocalReply`
  leads/closers. Verbatim repetition down a page is gone (a sample went from ~4 to ~11
  distinct "why" lines across 32 picks).
- **Dropped the percentage.** `composeLocalReply` no longer prints `${score}% match for
  your taste`; it emits a *qualitative* cue (e.g. "— a strong fit") only when the score
  is genuinely high **and** the pick is in the requested area, else nothing — never a
  number.
- **Grouped allergen line.** `orderGuideToReply` now groups cautions by allergen ("the X
  and Z might contain milk") instead of repeating "may contain" per dish; the always-on
  "confirm with the kitchen" is unchanged.
- **Claude prompts re-voiced.** Both `askClaude` and `askClaudeOrder` system prompts now
  carry the same voice guidance, a one-line voice example, and an explicit ban on machine
  tells (percentages, "match for your taste", formulaic openers). The STRICT-JSON contract
  and `sanitizePicks` validation are untouched.

## Key decisions & rationale (incl. alternatives rejected)

- **Deterministic seeding, NOT random rotation.** Random phrasing per view would be a
  slot-machine pattern — exactly what CLAUDE.md forbids — and would make the same spot
  read differently on every load. Seeding on a stable id keeps a given spot's wording
  fixed while breaking up repetition across a *list*. This is the load-bearing call and
  the one most likely to be re-litigated ("why not just `Math.random()`?").
- **Both engines, not just one.** Fixing only the keyless path would leave a visible
  seam when a key is present; fixing only Claude would leave the default-shipped
  experience robotic. The two now share one house voice so a user can't tell which
  answered.
- **Qualitative cue over a number, and omit when weak.** We kept *some* signal of fit
  but refused to surface the raw score — both because it's a machine tell and because
  claiming a "strong fit" for an out-of-area fallback would be dishonest.
- **Kept honesty guardrails.** No invented dishes (`sanitizePicks` unchanged), no fake
  counts (the neutral fallback reason avoids implying crowd data we lack), allergen note
  still always pairs with "ask the kitchen". The recommendation engine
  (`recommend.ts`) and scoring were not touched — this is voice only.
- **Did NOT add a temperature bump (yet).** Sonnet 4.6 still accepts `temperature`, but
  prompt + few-shot example are the primary lever and the local seeding already supplies
  variety; a temperature change is held as a future option if outputs read too same-y.

## Follow-up: small-talk handling (same day)

Testing surfaced a related un-naturalness: the concierge **forced restaurant picks for
non-requests**. Saying "thanks" returned recommendations with an awkward "Nothing in
your message to go on, but…" — because the Claude prompt always required 3–4 picks.

- **Deterministic conversational gate** (`conversationalReply` in `assistant/route.ts`):
  pure social messages (greeting / thanks / acknowledgment / sign-off) get a warm,
  seeded one-liner and an **empty** `restaurantIds` (no cards), short-circuiting before
  recommend/Claude. Match is anchored to the whole message, so "thanks, now find tacos"
  is **not** swallowed.
- **Claude belt-and-suspenders:** the prompt now tells the model to reply in one short
  line with an empty `restaurantIds` when the message isn't a recommendation request;
  `askClaude` surfaces an *intentionally empty* array as a conversational reply, while a
  *non-empty-but-all-invalid* array still falls back to the local engine (the
  hallucination guard is preserved by distinguishing the two).
- **Emoji + em-dash ban (`sanitizeReplyText` in `order.ts`, shared/pure).** Claude was
  slipping 😊 into chit-chat and leaning on em dashes, which read "AI". Both prompts now
  say "plain text only: no emoji, no em dashes (use commas/periods)", AND a server-side
  `sanitizeReplyText` enforces it on all model output (concierge reply + the order
  guide's `intro`/`why`): strips emoji (surrogate-pair + targeted BMP, sparing ★ ◆ ◷ ·)
  and converts em dashes → comma (en dashes only when spaced, so "2–3pm" survives). All
  hand-written copy pools were also rewritten dash-free. Avoids the `u` regex flag (es5).
- The client already renders cards only when `restaurantIds.length > 0`, so empty replies
  show as a plain bubble — no UI change needed.

**Known limitation (not addressed here):** the concierge is **stateless** — each request
sends only the query + taste profile, no prior turns, so there is no conversation memory.
A follow-up could thread recent messages into the prompt; deferred.

## Status

Shipped. Verified by `npm run typecheck && npm run build`, a throwaway keyless render
probe (deleted), and end-to-end curls of `/api/assistant` — confirming the local path
reads natural with no percentages, and that small talk ("thanks", "hey", "haha you're
the best") returns a warm one-liner with no cards and no emoji, while real cravings
("spicy ramen", "thanks, now find tacos") still recommend.
