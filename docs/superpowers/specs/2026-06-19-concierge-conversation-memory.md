# Handoff: concierge conversation memory

**Status:** Planned (not started) · **Created:** 2026-06-19 · **For:** the next session

## Why / goal

The AI concierge (`/assistant`) is **stateless** — each request sends only the latest
query + taste profile, never prior turns. So natural follow-ups fail:

- "spicy thai" → good picks. Then "**something cheaper**" → the bot forgets it was
  talking about spicy Thai and recommends city-wide cheap spots.
- "**what about Pilsen?**", "**more like the first one**", "**anything less fancy?**" all
  lose context.

Goal: make the concierge carry conversation context so refinements compose, while
**keeping the server stateless** (no DB — consistent with the deferred-DB stance in
`planning/2026-06-17-data-storage-db-assessment.md`). Memory lives **client-side** (it's
already in the store) and is **sent with each request**.

## Current state (grounding — verify before editing)

- **Route:** `src/app/api/assistant/route.ts` (`runtime = "nodejs"`), stateless.
  - `Body = { query: string; profile: TasteProfile; nearNeighborhood?: string | null }`.
  - Flow: rate-limit (15/min in-memory) → `conversationalReply()` small-talk gate →
    `isOrderIntent()` "what to order at X" gate → `parseQuery(query)` → blend into
    `TasteProfile` → `recommend(...)` over `RESTAURANTS_FULL` → top 8 candidates →
    `askClaude(apiKey, query, profile, candidates, neighborhood)` if a key is set, else
    `composeLocalReply(...)`.
  - `askClaude` does a **raw fetch** to `https://api.anthropic.com/v1/messages`, model
    `claude-sonnet-4-6`, `max_tokens: 400`, **single** user message, STRICT JSON
    `{reply, restaurantIds}`. (No SDK; no streaming.) `sanitizeReplyText()` strips
    emoji/em-dashes from the reply.
- **Client:** `src/app/assistant/page.tsx`. Conversation is held in the Zustand store as
  `AssistantMsg[]` and is **in-memory only** (survives in-app back-nav via `partialize`,
  resets on a fresh open). `send(q)` POSTs `{ query, profile, nearNeighborhood }` — **no
  history today**.
  - `AssistantMsg = { role: "user" | "assistant"; text: string; restaurantIds?: string[]; engine?: string }`
    (`src/lib/store.ts:20`). Store getters/setters: `assistantMessages`,
    `setAssistantMessages`.
- The deterministic small-talk gate, order-intent gate, and `composeLocalReply` all key
  off the **latest message only** — keep that.

## Design (recommended v1)

Two layers, because memory has to fix **both** what's said and what's *recommended*:

### 1. Pass a bounded history from client → route
- In `send()`, before appending the new user turn, build `history` from the store's
  current `assistantMessages`: map to `{ role, text }`, **drop `restaurantIds`/`engine`**,
  and keep only the **last ~6 messages** (≈3 turns). Add `history` to the POST body.
- Extend `Body` with `history?: { role: "user" | "assistant"; text: string }[]`.
  **Server-side, re-trim and clamp** (cap to last 6, cap each text to ~500 chars, drop
  empties) — it's client-supplied, so bound tokens/abuse. Don't trust the client's length.

### 2. Accumulate intent for the candidate pool (the load-bearing part)
A refinement like "cheaper" must not discard the earlier "spicy thai". Build a **merged
craving** by running `parseQuery()` over the recent **user** turns (history + current),
later turns taking precedence / unioning:
- cuisines, vibes (union), price, neighborhood, spiceTolerance, undergroundBias.
- Use the merged result (not just `parseQuery(currentQuery)`) to build `blended` +
  `neighborhood` for the `recommend(...)` candidate pool.
- Consider a small helper `mergeCravings(userTexts: string[])` in `recommend.ts` (next to
  `parseQuery`) so search/concierge can share it later.

### 3. Make `askClaude` conversational
- Pass `history` into `askClaude`; build the `messages` array as **alternating prior
  turns** (`{role, content: text}`) followed by the final user message (the one that
  carries the candidates JSON). History already alternates user/assistant and ends with an
  assistant turn, so appending the new user message preserves alternation — but **guard**:
  the array must start with `user` (drop a leading assistant) and roles must alternate.
- Add one line to the system prompt: *"This is a continuing conversation. Honor what the
  user already told you and treat the latest message as a refinement of it, not a fresh
  start."* Keep the STRICT JSON contract and all existing voice rules unchanged.

### Local fallback (no key)
`composeLocalReply` can't really converse, but with the **merged-intent candidate pool**
its refinements already pick better spots. Acceptable for v1 — leave the copy as-is.

## Out of scope (note as v2, don't build now)
- **Referring to prior picks** ("the first one", "tell me about #2"): would need to pass
  prior `restaurantIds`/names so the model can resolve references. Tempting but adds
  surface; defer.
- Server-side/persistent memory or a DB — explicitly **not** this (keep statelessness).
- Cross-session persistence (conversation still resets on a fresh app open).

## Verification
- `npm run typecheck && npm run build`.
- Local dev **with** a key (`.env`), via the UI — the multi-turn refinement chain:
  1. "spicy thai" → Thai picks.
  2. "something cheaper" → still spicy Thai, lower price.
  3. "what about Pilsen?" → spicy + cheaper + Pilsen (or honest "thin here" fallback).
- **Keyless** (rename the key): the same chain should still narrow the candidate pool
  (engine reads "local").
- Confirm small-talk ("thanks") and order-intent ("what should I order at X") still
  short-circuit correctly mid-conversation.
- Guards: oversized/garbage `history` is clamped server-side (test a 50-message body).
- Reuse the throwaway `npx tsx` probe pattern (committed-then-deleted) to eyeball
  `mergeCravings` output across a few synthetic conversations.

## Docs to update when done
- `docs/feature-timeline.md` entry; if the "merged intent" call gets non-obvious, a
  `docs/decisions/` note. Update `docs/decisions/2026-06-19-chatbot-voice-naturalness.md`
  "Known limitation" line (memory now exists). Move the ROADMAP entry to shipped.
