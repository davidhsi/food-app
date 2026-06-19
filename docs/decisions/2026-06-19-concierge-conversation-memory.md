# Design decision: concierge conversation memory (stateless server, merged intent)

**Date:** 2026-06-19
**Status:** Shipped
**Author:** David Hsi (with Claude)
**Related:** handoff `docs/superpowers/specs/2026-06-19-concierge-conversation-memory.md`,
`2026-06-19-chatbot-voice-naturalness.md` (resolves its "stateless" known-limitation),
`planning/2026-06-17-data-storage-db-assessment.md` (the deferred-DB stance this honors),
`docs/feature-timeline.md`.

## Problem & goal

The `/assistant` concierge was **stateless**: each request sent only the latest query +
taste profile. Natural follow-ups failed — "spicy thai" then "something cheaper" forgot
the Thai and recommended city-wide cheap spots; "what about Pilsen?" lost the rest.

Goal: make refinements **compose** (narrow, not reset) while keeping the **server
stateless** — no DB, consistent with the deferred-DB assessment. Memory is client-held
(already in the Zustand store) and sent with each request.

## What shipped

Two layers, because memory has to fix both what's *said* and what's *recommended*:

1. **Client → server bounded history.** `assistant/page.tsx` sends `history` (last 6
   prior turns, `{role, text}` only) on the POST body. The server re-clamps it
   (`clampHistory`: ≤6 turns, ≤500 chars/turn, drop empties/bad roles) — it's untrusted.
2. **Merged intent for the candidate pool** (`mergeCravings` in `recommend.ts`): run
   `parseQuery` over the recent user turns and fold the results into one craving, used to
   build the `recommend(...)` pool.
3. **Multi-turn `askClaude`**: prior turns become an alternating Anthropic `messages`
   array; one system-prompt line frames the latest message as a refinement. STRICT-JSON
   contract, the small-talk + order-intent gates, `sanitizeReplyText`, and the voice rules
   are unchanged.

## Key decisions & rationale (incl. alternatives rejected)

- **Stateless server, client-held memory — NOT a session store / DB.** A server-side
  conversation store is the "obvious" design but trips the deferred-DB trigger for a
  feature that doesn't need durability (the chat already resets on a fresh app open). The
  client already holds the transcript; sending a bounded slice keeps the server a pure
  function and costs only a few hundred tokens. Persistent/cross-session memory is
  explicitly **out of scope** (v2).
- **Accumulate intent, don't just pass transcript to Claude.** Passing history to Claude
  alone would fix the *prose* but not the *candidate pool* — the local engine builds the
  candidates Claude must pick from, so "something cheaper" with no merged cuisine would
  hand Claude a city-wide-cheap pool and no Thai option to choose. Merging intent into the
  pool is the load-bearing half, and it's what makes the **keyless** fallback narrow too.
- **Merge semantics: later-turn-wins per field, vibes union, "near me" last-wins.** The
  re-litigable call. Cuisines/price/neighborhood/spice take the latest turn that specifies
  them, so "actually, italian" *corrects* "thai" rather than stacking an incoherent
  Thai+Italian pool. Vibes **union** because they compose, not contradict ("date night"
  that's also "cozy"). "Near me" is last-wins (not accumulated) because it's a fresh
  spatial intent tied to the current message — the client only resolves geolocation for
  the latest turn, so a stale "near me" from two turns ago has no coordinates and must not
  linger; a later named neighborhood ("what about Pilsen?") cleanly takes over. Rejected:
  unioning cuisines (produces incoherent multi-cuisine pools on a correction).
- **Guard the Claude `messages` array explicitly** (`toClaudeMessages`). The API requires
  the array to start with `user` and alternate. Client history is untrusted, so the helper
  drops a leading assistant turn, merges consecutive same-role turns, and folds the current
  candidates message into a trailing user turn — always ending on the current message.
  Verified across empty / leading-assistant / dangling-user / consecutive / all-garbage
  inputs.

## Status

Shipped. Verified by `npm run typecheck && npm run build`; throwaway `tsx` probes (deleted)
for `mergeCravings` output and `toClaudeMessages` alternation; and live keyless `/api/assistant`
curls of the refinement chain ("spicy thai" → "something cheaper" → "what about Pilsen?"
narrows to cheap Thai in Pilsen), the small-talk + order-intent gates mid-conversation, and
a 50-message oversized-history body (clamped, no error). The keyed multi-turn Claude path
was code-reviewed and type-checked but not exercised live (no `ANTHROPIC_API_KEY` available
in the dev environment).
