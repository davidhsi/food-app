# "Open now" concierge awareness — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the AI concierge and detail page aware of whether a restaurant is open right now, backed by a real Google opening-hours re-ingest.

**Architecture:** A pure `isOpenNow(hours, nowMs)` engine reads a normalized `OpeningHours` shape (ingested from Google `regularOpeningHours` + `utcOffsetMinutes`). The concierge detects time-intent in the query, steers its candidate pool toward open spots, and threads open/closed + a Google-hours caveat into both the Claude prompt and the keyless local reply. The detail page shows an honest open/closed line. `hours` lives in the server `full` dataset only.

**Tech Stack:** Next.js 14 App Router, TypeScript (strict), Zustand, Google Places API (New), Anthropic Messages API. No test runner — pure logic is verified with `node:assert` `scripts/*.check.ts` probes; the gate is `npm run typecheck && npm run build`.

## Global Constraints

- **Verify gate:** `npm run typecheck && npm run build` must pass; pure logic also via `npx tsx scripts/<x>.check.ts`. No test framework may be added.
- **Semantic color tokens only**, no raw hex in components. Tokens: `paper`, `paper-raised`, `ink`, `ink-soft`, `ink-faint`, `olive`, `olive-deep`, `line`, `gem`.
- **No pictographic emoji as UI.** Text glyphs `● ○ ◷ · ★ ◆` are acceptable.
- **Honest provenance:** wherever open/closed is asserted, show "hours via Google / confirm with the spot". Missing hours = `unknown`, never penalized, never claimed open. No counts.
- **The recommendation engine is never hard-filtered by hours** — open-now is a strong steer (boost open, demote closed) that never empties the pool.
- **`hours` is server-`full` only** — stripped from client `core` by `split-data`.
- **Day numbering:** Google `periods` use `0 = Sunday … 6 = Saturday`. Google `weekdayDescriptions` are ordered **Monday-first** (index 0 = Monday … 6 = Sunday). These differ — handle each explicitly.
- **`scripts/` is CommonJS** — never add `scripts/package.json` with `"type":"module"`.

---

### Task 1: Hours types + pure `isOpenNow` engine

**Files:**
- Modify: `src/lib/types.ts` (add `OpeningHours`, add `Restaurant.hours?`)
- Create: `src/lib/hours.ts`
- Create (test): `scripts/hours.check.ts`

**Interfaces:**
- Produces: `interface OpeningHours { periods: { openDay:number; openMin:number; closeDay:number; closeMin:number }[]; weekdayText: string[]; utcOffsetMinutes: number }`; `Restaurant.hours?: OpeningHours`; `type OpenState = "open"|"closed"|"unknown"`; `isOpenNow(hours: OpeningHours | undefined, nowMs: number): OpenState`; `todayHoursText(hours: OpeningHours | undefined, nowMs: number): string | null`.

- [ ] **Step 1: Add the types.** In `src/lib/types.ts`, after the `Reel` interface (before `interface Restaurant`), add:

```ts
/**
 * Normalized opening hours derived at ingest from Google `regularOpeningHours`.
 * `openMin`/`closeMin` are minutes-from-midnight in the venue's LOCAL time.
 * Day numbering matches Google periods: 0 = Sunday … 6 = Saturday. Overnight
 * periods have `closeDay`/`closeMin` that wrap past the open instant (handled in
 * `isOpenNow`). A 24/7 venue is a single period with open == close (full week).
 * Detail-only / server-`full`: stripped from the client `core` dataset.
 */
export interface OpeningHours {
  periods: { openDay: number; openMin: number; closeDay: number; closeMin: number }[];
  weekdayText: string[]; // Google `weekdayDescriptions`, Monday-first, for display
  utcOffsetMinutes: number; // the venue's own UTC offset
}
```

Then inside `interface Restaurant`, after the `topDishes?` field, add:

```ts
  /**
   * Opening hours (Google). Optional — absent until a keyed re-ingest populates
   * it. Server-`full` only (stripped from `core`), so client `core` records
   * never carry it; `isOpenNow` returns "unknown" when absent.
   */
  hours?: OpeningHours;
```

- [ ] **Step 2: Write the failing test.** Create `scripts/hours.check.ts`:

```ts
import assert from "node:assert/strict";
import { isOpenNow, todayHoursText } from "../src/lib/hours";
import type { OpeningHours } from "../src/lib/types";

// Venue-local == UTC when offset is 0, so these instants read directly.
// 2024-01-01 is a Monday; 2024-01-06 a Saturday; 2024-01-07 a Sunday.
const monAfternoon = Date.UTC(2024, 0, 1, 14, 0); // Mon 14:00
const monMorning = Date.UTC(2024, 0, 1, 9, 0); // Mon 09:00 (before open)
const monNight = Date.UTC(2024, 0, 1, 22, 0); // Mon 22:00 (after close)

const weekday: OpeningHours = {
  periods: [{ openDay: 1, openMin: 660, closeDay: 1, closeMin: 1260 }], // Mon 11:00-21:00
  weekdayText: ["Monday: 11:00 AM – 9:00 PM"],
  utcOffsetMinutes: 0,
};
assert.equal(isOpenNow(weekday, monAfternoon), "open");
assert.equal(isOpenNow(weekday, monMorning), "closed");
assert.equal(isOpenNow(weekday, monNight), "closed");
assert.equal(isOpenNow(undefined, monAfternoon), "unknown");
assert.equal(isOpenNow({ ...weekday, periods: [] }, monAfternoon), "unknown");

// Overnight: Fri 18:00 -> Sat 02:00
const overnight: OpeningHours = {
  periods: [{ openDay: 5, openMin: 1080, closeDay: 6, closeMin: 120 }],
  weekdayText: [],
  utcOffsetMinutes: 0,
};
assert.equal(isOpenNow(overnight, Date.UTC(2024, 0, 6, 1, 0)), "open"); // Sat 01:00
assert.equal(isOpenNow(overnight, Date.UTC(2024, 0, 6, 3, 0)), "closed"); // Sat 03:00

// Week-wrap: Sat 22:00 -> Sun 02:00, checked Sun 01:00
const weekWrap: OpeningHours = {
  periods: [{ openDay: 6, openMin: 1320, closeDay: 0, closeMin: 120 }],
  weekdayText: [],
  utcOffsetMinutes: 0,
};
assert.equal(isOpenNow(weekWrap, Date.UTC(2024, 0, 7, 1, 0)), "open"); // Sun 01:00

// 24/7: single period with open == close
const allDay: OpeningHours = {
  periods: [{ openDay: 0, openMin: 0, closeDay: 0, closeMin: 0 }],
  weekdayText: [],
  utcOffsetMinutes: 0,
};
assert.equal(isOpenNow(allDay, monAfternoon), "open");
assert.equal(isOpenNow(allDay, monNight), "open");

// Offset correctness: venue at -300 (CST). 16:00 UTC == 11:00 local Monday.
const offsetVenue: OpeningHours = { ...weekday, utcOffsetMinutes: -300 };
assert.equal(isOpenNow(offsetVenue, Date.UTC(2024, 0, 1, 16, 0)), "open"); // 11:00 local
assert.equal(isOpenNow(offsetVenue, Date.UTC(2024, 0, 1, 13, 0)), "closed"); // 08:00 local

// todayHoursText: Monday maps to weekdayText[0] (Monday-first array)
assert.equal(todayHoursText(weekday, monAfternoon), "Monday: 11:00 AM – 9:00 PM");
assert.equal(todayHoursText(undefined, monAfternoon), null);

console.log("hours.check ok");
```

- [ ] **Step 3: Run it; verify it fails.** Run: `npx tsx scripts/hours.check.ts`. Expected: FAIL (Cannot find module `../src/lib/hours`).

- [ ] **Step 4: Implement `src/lib/hours.ts`:**

```ts
import { OpeningHours } from "./types";

export type OpenState = "open" | "closed" | "unknown";

const WEEK_MIN = 7 * 24 * 60;

/** Venue-local {day:0..6 (0=Sun), minutesFromMidnight} for an epoch instant. */
function venueLocal(nowMs: number, utcOffsetMinutes: number): { day: number; min: number } {
  // Shift the UTC instant by the venue's offset, then read UTC fields — those
  // now hold the venue's wall-clock values, independent of the runtime's own tz.
  const d = new Date(nowMs + utcOffsetMinutes * 60_000);
  return { day: d.getUTCDay(), min: d.getUTCHours() * 60 + d.getUTCMinutes() };
}

/**
 * Is the venue open at `nowMs`? "unknown" when hours are absent (e.g. a client
 * `core` record, or pre-ingest). Handles overnight and week-wrapping periods,
 * and 24/7 (a single period whose open == close).
 */
export function isOpenNow(hours: OpeningHours | undefined, nowMs: number): OpenState {
  if (!hours || hours.periods.length === 0) return "unknown";
  const { day, min } = venueLocal(nowMs, hours.utcOffsetMinutes);
  const now = day * 24 * 60 + min; // 0..WEEK_MIN
  for (const p of hours.periods) {
    const open = p.openDay * 24 * 60 + p.openMin;
    let close = p.closeDay * 24 * 60 + p.closeMin;
    if (close <= open) close += WEEK_MIN; // overnight / week-wrap / 24-7
    // Check the instant and the same instant a week later, so a Sunday-morning
    // that belongs to a Saturday-night period still lands inside the interval.
    if ((now >= open && now < close) || (now + WEEK_MIN >= open && now + WEEK_MIN < close)) {
      return "open";
    }
  }
  return "closed";
}

/** The venue-local day's human hours string, or null. Google `weekdayText` is
 * Monday-first (index 0 = Monday), while `getUTCDay` is Sunday=0 — remap. */
export function todayHoursText(hours: OpeningHours | undefined, nowMs: number): string | null {
  if (!hours || hours.weekdayText.length === 0) return null;
  const { day } = venueLocal(nowMs, hours.utcOffsetMinutes);
  const idx = day === 0 ? 6 : day - 1;
  return hours.weekdayText[idx] ?? null;
}
```

- [ ] **Step 5: Run the test; verify it passes.** Run: `npx tsx scripts/hours.check.ts`. Expected: prints `hours.check ok`.

- [ ] **Step 6: Typecheck + commit.**

```bash
npm run typecheck
git add src/lib/types.ts src/lib/hours.ts scripts/hours.check.ts
git commit -m "feat(hours): OpeningHours type + pure isOpenNow engine"
```

---

### Task 2: Recommend-engine integration (time-intent + scorer steer)

**Files:**
- Modify: `src/lib/recommend.ts` (`parseQuery`, `mergeCravings`, `SignalState`, `scoreRestaurant`)
- Temp probe (committed-then-deleted): `scripts/_openprobe.check.ts`

**Interfaces:**
- Consumes: `isOpenNow` from Task 1.
- Produces: `parseQuery(q).openNow?: boolean`; `SignalState.openNow?: boolean`; `SignalState.nowMs?: number`. Scorer adds +30 (reason "Open now") for open, -40 for closed when `openNow` && `nowMs` are set; unknown → no change.

- [ ] **Step 1: Write the probe (failing test).** Create `scripts/_openprobe.check.ts`:

```ts
import assert from "node:assert/strict";
import { parseQuery, scoreRestaurant, SignalState } from "../src/lib/recommend";
import { RESTAURANTS } from "../src/lib/data";
import type { OpeningHours, TasteProfile } from "../src/lib/types";

// parseQuery time-intent
assert.equal(parseQuery("what's good and open now near me").openNow, true);
assert.equal(parseQuery("what's open right now").openNow, true);
assert.equal(parseQuery("still open?").openNow, true);
assert.equal(parseQuery("cheap thai in Pilsen").openNow, undefined);

// scorer: open boosts above closed; unknown is neutral
const base = RESTAURANTS[0];
const monAfternoon = Date.UTC(2024, 0, 1, 14, 0);
const openHrs: OpeningHours = {
  periods: [{ openDay: 1, openMin: 0, closeDay: 1, closeMin: 1439 }],
  weekdayText: [], utcOffsetMinutes: 0,
};
const closedHrs: OpeningHours = {
  periods: [{ openDay: 2, openMin: 600, closeDay: 2, closeMin: 1000 }],
  weekdayText: [], utcOffsetMinutes: 0,
};
const profile = { cuisines: [], price: [], vibes: [], dietary: [], spiceTolerance: 1, adventurousness: 0.5, undergroundBias: 0.5 } as TasteProfile;
const state = (hours?: OpeningHours): SignalState => ({ profile, liked: [], saved: [], ranked: [], openNow: true, nowMs: monAfternoon });
const open = scoreRestaurant({ ...base, hours: openHrs }, state());
const closed = scoreRestaurant({ ...base, hours: closedHrs }, state());
const unknown = scoreRestaurant({ ...base, hours: undefined }, state());
assert.ok(open.precise > unknown.precise, "open beats unknown");
assert.ok(unknown.precise > closed.precise, "unknown beats closed");
assert.ok(open.reasons.some((r) => r.label === "Open now"), "open reason present");

console.log("_openprobe ok");
```

- [ ] **Step 2: Run it; verify it fails.** Run: `npx tsx scripts/_openprobe.check.ts`. Expected: FAIL (`openNow` undefined / no "Open now" reason).

- [ ] **Step 3: Add time-intent to `parseQuery`.** In `src/lib/recommend.ts`, extend the `parseQuery` return type (both the function signature and the local `profile` object type) to include `openNow?: boolean`. Then, just after the `nearMe` detection block, add:

```ts
  // "open now" / "what's open" — temporal intent tied to the current moment.
  // Pure detection; the caller supplies `nowMs` (client clock) to the scorer.
  if (/\bopen\s+(now|right\s+now)\b|\bwhat(?:'|’)?s\s+open\b|\bstill\s+open\b/.test(text)) {
    profile.openNow = true;
  }
```

(The signature change: in both `parseQuery`'s return type and its `mergeCravings` `ReturnType` usage the field is inherited automatically, but `parseQuery`'s explicit return annotation `Partial<TasteProfile> & { keywords: string[]; neighborhood?: string; nearMe?: boolean }` must gain `openNow?: boolean`. Update both the function return type annotation AND the inner `const profile: ... =` annotation.)

- [ ] **Step 4: Carry `openNow` through `mergeCravings`.** In `mergeCravings`, just after the `merged.nearMe = p.nearMe;` line, add:

```ts
    // Open-now is a fresh temporal intent on the current turn (last-wins, like
    // nearMe — a later non-temporal turn clears it).
    merged.openNow = p.openNow;
```

- [ ] **Step 5: Extend `SignalState` + add the scorer step.** In the `SignalState` interface, after `neighborhoodStrict?`, add:

```ts
  // Concierge-only "open now" steer. When `openNow` is set, the scorer boosts
  // open spots and demotes closed ones, judged against `nowMs` (the client's
  // clock). Inert on the client: `core` records carry no `hours`.
  openNow?: boolean;
  nowMs?: number;
```

Add the import at the top of the file: `import { isOpenNow } from "./hours";`

In `scoreRestaurant`, immediately after the neighborhood soft-steer block (step 9b) and before "10. Novelty / already-seen damping", add:

```ts
  // 9c. Open-now steer (concierge-only). Strong but never a hard filter:
  // boost open, demote closed, leave unknown untouched (no penalty for missing
  // hours data — honest). Closed isn't removed; the pool never empties.
  if (state.openNow && state.nowMs != null) {
    const open = isOpenNow(r.hours, state.nowMs);
    if (open === "open") {
      score += 30;
      reasons.push({ label: "Open now", weight: 30 });
    } else if (open === "closed") {
      score -= 40;
    }
  }
```

- [ ] **Step 6: Run the probe; verify it passes.** Run: `npx tsx scripts/_openprobe.check.ts`. Expected: prints `_openprobe ok`.

- [ ] **Step 7: Typecheck, remove the probe, commit.**

```bash
npm run typecheck
rm scripts/_openprobe.check.ts
git add src/lib/recommend.ts
git commit -m "feat(recommend): open-now time-intent + scorer steer"
```

---

### Task 3: Ingest derivation — Places field mask + `hoursFrom`

**Files:**
- Modify: `scripts/places.ts` (`FIELD_MASK`, `RawPlace`)
- Modify: `scripts/derive.ts` (add `hoursFrom`)
- Modify (test): `scripts/derive.check.ts`

**Interfaces:**
- Produces: `RawPlace.regularOpeningHours?` + `RawPlace.utcOffsetMinutes?`; `hoursFrom(raw: RawPlace): OpeningHours | undefined` in `scripts/derive.ts`.

- [ ] **Step 1: Extend the field mask + raw type.** In `scripts/places.ts`, add to `RawPlace` (after `websiteUri?`):

```ts
  regularOpeningHours?: {
    periods?: {
      open: { day: number; hour: number; minute: number };
      close?: { day: number; hour: number; minute: number };
    }[];
    weekdayDescriptions?: string[];
  };
  utcOffsetMinutes?: number;
```

And add to the `FIELD_MASK` array (before `"nextPageToken"`):

```ts
  "places.regularOpeningHours",
  "places.utcOffsetMinutes",
```

- [ ] **Step 2: Write the failing test.** In `scripts/derive.check.ts`, add the import to the existing `from "./derive"` block: add `hoursFrom,`. Then append before the final `console.log`:

```ts
// hoursFrom: maps Google periods + offset; missing -> undefined
assert.equal(hoursFrom({ id: "x", utcOffsetMinutes: -300 }), undefined); // no periods
assert.equal(hoursFrom({ id: "x", regularOpeningHours: { periods: [] }, utcOffsetMinutes: -300 }), undefined);
assert.equal(hoursFrom({ id: "x", regularOpeningHours: { periods: [{ open: { day: 1, hour: 11, minute: 0 } }] } }), undefined); // no offset
const h = hoursFrom({
  id: "x",
  regularOpeningHours: {
    periods: [{ open: { day: 1, hour: 11, minute: 0 }, close: { day: 1, hour: 21, minute: 30 } }],
    weekdayDescriptions: ["Monday: 11:00 AM – 9:30 PM"],
  },
  utcOffsetMinutes: -300,
});
assert.deepEqual(h!.periods[0], { openDay: 1, openMin: 660, closeDay: 1, closeMin: 1290 });
assert.equal(h!.utcOffsetMinutes, -300);
assert.deepEqual(h!.weekdayText, ["Monday: 11:00 AM – 9:30 PM"]);
// 24/7: a period with no close maps to open == close (full week downstream)
const allDay = hoursFrom({
  id: "x",
  regularOpeningHours: { periods: [{ open: { day: 0, hour: 0, minute: 0 } }] },
  utcOffsetMinutes: 0,
});
assert.deepEqual(allDay!.periods[0], { openDay: 0, openMin: 0, closeDay: 0, closeMin: 0 });
```

- [ ] **Step 3: Run it; verify it fails.** Run: `npx tsx scripts/derive.check.ts`. Expected: FAIL (`hoursFrom` is not a function / not exported).

- [ ] **Step 4: Implement `hoursFrom`.** In `scripts/derive.ts`, add the import at the top: `import { Cuisine, OpeningHours, Price } from "../src/lib/types";` (extend the existing `types` import to include `OpeningHours`). Also import the raw type: add `import type { RawPlace } from "./places";`. Then add:

```ts
/**
 * Map Google `regularOpeningHours` + `utcOffsetMinutes` into the normalized
 * `OpeningHours` shape. Returns undefined when periods or the offset are absent.
 * A period with no `close` (Google's 24/7 encoding) becomes open == close, which
 * `isOpenNow` treats as the full week.
 */
export function hoursFrom(raw: RawPlace): OpeningHours | undefined {
  const roh = raw.regularOpeningHours;
  if (!roh?.periods?.length || typeof raw.utcOffsetMinutes !== "number") return undefined;
  const periods = roh.periods.map((p) => {
    const openMin = p.open.hour * 60 + p.open.minute;
    return {
      openDay: p.open.day,
      openMin,
      closeDay: p.close ? p.close.day : p.open.day,
      closeMin: p.close ? p.close.hour * 60 + p.close.minute : openMin,
    };
  });
  return {
    periods,
    weekdayText: roh.weekdayDescriptions ?? [],
    utcOffsetMinutes: raw.utcOffsetMinutes,
  };
}
```

- [ ] **Step 5: Run the test; verify it passes.** Run: `npx tsx scripts/derive.check.ts`. Expected: prints `derive.check ok`.

- [ ] **Step 6: Commit.**

```bash
npm run typecheck
git add scripts/places.ts scripts/derive.ts scripts/derive.check.ts
git commit -m "feat(ingest): request + derive Google opening hours"
```

---

### Task 4: Pipeline plumbing — attach, strip from core, validate

**Files:**
- Modify: `scripts/ingest.ts` (attach `hours`)
- Modify: `scripts/split-data.ts` (strip `hours` from core)
- Modify: `scripts/validate-data.ts` (assert shape when present)

**Interfaces:**
- Consumes: `hoursFrom` (Task 3).
- Produces: full dataset records carry `hours`; `core` records do not.

- [ ] **Step 1: Attach hours in ingest.** In `scripts/ingest.ts`, add `hoursFrom,` to the existing import block from `"./derive"`. Then in the `restaurants.push({ ... })` object, after `topDishes: editorial.topDishes,`, add:

```ts
      hours: hoursFrom(place),
```

- [ ] **Step 2: Strip hours from core.** In `scripts/split-data.ts`, change the strip list and the `toCore` return type:

```ts
export const DETAIL_ONLY_FIELDS = ["insiderTip", "blurb", "hours"] as const;
```

```ts
export function toCore(r: Restaurant): Omit<Restaurant, "insiderTip" | "blurb" | "hours"> {
  const core: Record<string, unknown> = { ...r };
  for (const f of DETAIL_ONLY_FIELDS) delete core[f];
  return core as Omit<Restaurant, "insiderTip" | "blurb" | "hours">;
}
```

- [ ] **Step 3: Validate shape when present.** In `scripts/validate-data.ts`, after the `if (r.topDishes) { ... }` block, add:

```ts
  if (r.hours) {
    assert.ok(Array.isArray(r.hours.periods), `hours.periods array on ${r.id}`);
    assert.ok(typeof r.hours.utcOffsetMinutes === "number", `hours.utcOffsetMinutes on ${r.id}`);
    assert.ok(Array.isArray(r.hours.weekdayText), `hours.weekdayText on ${r.id}`);
  }
```

- [ ] **Step 4: Verify plumbing without a live ingest.** The current committed dataset has no `hours`, so `validate-data` still passes (the block is guarded) and `split-data` is a no-op for the new field. Run:

```bash
npm run typecheck
npm run split-data
npm run validate-data
```

Expected: `split-data` writes core records; `validate-data` prints `validate-data ok: <N> restaurants across <M> neighborhoods`. (Confirm `git status` shows no change to `restaurants.core.json` — nothing to strip yet.)

- [ ] **Step 5: Commit.**

```bash
git add scripts/ingest.ts scripts/split-data.ts scripts/validate-data.ts
git commit -m "feat(ingest): attach hours, strip from core, validate shape"
```

---

### Task 5: Concierge surface — route + client `userTime`

**Files:**
- Modify: `src/app/api/assistant/route.ts`
- Modify: `src/app/assistant/page.tsx`

**Interfaces:**
- Consumes: `parseQuery().openNow`, `SignalState.openNow/nowMs` (Task 2); `isOpenNow`, `todayHoursText` (Task 1).
- Produces: request `Body.userTime?: number`; candidates carry `openNow`/`todayHours`; reply carries the Google-hours caveat when temporal.

- [ ] **Step 1: Send `userTime` from the client.** In `src/app/assistant/page.tsx`, change the fetch body (currently `JSON.stringify({ query, profile, nearNeighborhood, history })`) to:

```ts
        body: JSON.stringify({ query, profile, nearNeighborhood, history, userTime: Date.now() }),
```

- [ ] **Step 2: Thread it through the route.** In `src/app/api/assistant/route.ts`:

  (a) Add to the `Body` interface (after `history?: Turn[];`):

```ts
  // Client wall-clock (epoch ms), used to judge "open now" against each venue's
  // own UTC offset. Optional; defaults to server time.
  userTime?: number;
```

  (b) Add to the imports from `"@/lib/order"`-adjacent block a new import line:

```ts
import { isOpenNow, todayHoursText } from "@/lib/hours";
```

  (c) After `const neighborhood = parsed.neighborhood ?? near;`, add:

```ts
  const nowMs = typeof body.userTime === "number" ? body.userTime : Date.now();
  const wantsOpen = !!parsed.openNow;
```

  (d) In the `recommend({ ... }, RESTAURANTS_FULL)` state object, add `openNow: wantsOpen,` and `nowMs,` alongside `neighborhood`/`neighborhoodStrict`.

  (e) Pass the new context into `askClaude` — change the call to:

```ts
      const result = await askClaude(
        apiKey,
        query,
        profile,
        localScored,
        neighborhood,
        history,
        wantsOpen ? nowMs : null,
      );
```

  (f) Update `askClaude`'s signature to accept `openNowAt: number | null = null` as the last parameter. Inside, enrich each `compact` candidate (add two fields to the mapped object), guarded so non-temporal queries don't pay for it:

```ts
    openNow: openNowAt != null ? isOpenNow(s.restaurant.hours, openNowAt) : undefined,
    todayHours: openNowAt != null ? todayHoursText(s.restaurant.hours, openNowAt) : undefined,
```

  (g) In `askClaude`'s `system` string, add this clause (e.g. right after the `neighborhood` clause):

```ts
    (openNowAt != null
      ? 'The user wants somewhere OPEN RIGHT NOW. Each candidate has an `openNow` field ("open" | "closed" | "unknown"). Strongly prefer "open" candidates; mention a "closed" one only if nothing is open, and say so plainly. Treat "unknown" as uncertain, do not claim it is open. ALWAYS end your reply with one short caveat line that you are going by Google\'s listed hours and they should confirm with the spot before heading out. '
      : "") +
```

  (h) Pass the temporal flag to the local fallback. Change `composeLocalReply(query, top, neighborhood)` to `composeLocalReply(query, top, neighborhood, wantsOpen)` and update `composeLocalReply`'s signature with `openNow = false` as a trailing param. Inside, just before the final `return`, build a caveat and append it:

```ts
  const hoursCaveat = openNow
    ? "\n\nI'm going by Google's listed hours, so confirm with the spot before you head out."
    : "";
```

and change the return to end with `...${closer}${hoursCaveat}` (append `${hoursCaveat}` after the existing template).

- [ ] **Step 3: Verify.**

```bash
npm run typecheck
npm run build
```

Expected: both pass (15 routes, `/api/assistant` compiles).

- [ ] **Step 4: Commit.**

```bash
git add src/app/api/assistant/route.ts src/app/assistant/page.tsx
git commit -m "feat(concierge): open-now awareness with Google-hours caveat"
```

---

### Task 6: Detail-page open/closed line

**Files:**
- Modify: `src/components/RestaurantDetail.tsx`

**Interfaces:**
- Consumes: `isOpenNow`, `todayHoursText` (Task 1); `OpeningHours` type; `Restaurant.hours` (full record passed by the server detail page).

- [ ] **Step 1: Add imports.** In `src/components/RestaurantDetail.tsx`, add near the other `@/lib` imports:

```ts
import { useEffect, useState } from "react"; // (merge into the existing react import if present)
import { isOpenNow, todayHoursText } from "@/lib/hours";
import type { OpeningHours } from "@/lib/types";
```

(If `useEffect`/`useState` are already imported, just add the two `@/lib` lines.)

- [ ] **Step 2: Add the `OpenNowLine` component.** At the bottom of the file (module scope, not inside the default export), add:

```tsx
/** Honest open/closed line. Renders nothing without hours (like UserDistance);
 * reads `Date.now()` in an effect to avoid an SSR/hydration mismatch. */
function OpenNowLine({ hours }: { hours?: OpeningHours }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);
  if (!hours || now === null) return null;
  const state = isOpenNow(hours, now);
  if (state === "unknown") return null;
  const open = state === "open";
  const today = todayHoursText(hours, now)?.replace(/^[A-Za-z]+:\s*/, "");
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-5 pt-4 text-sm">
      <span className={open ? "font-semibold text-olive-deep" : "font-semibold text-ink-faint"}>
        {open ? "● Open now" : "○ Closed"}
      </span>
      {today && <span className="text-ink-soft">{today}</span>}
      <span className="text-xs text-ink-faint">Hours via Google</span>
    </div>
  );
}
```

- [ ] **Step 3: Render it below the hero.** Immediately after the hero block's closing `</div>` (the one closing the relative hero container at ~line 111, right before the `{/* Earliness cue ... */}` comment), add:

```tsx
      <OpenNowLine hours={r.hours} />
```

- [ ] **Step 4: Verify.**

```bash
npm run typecheck
npm run build
```

Expected: both pass.

- [ ] **Step 5: Manual visual check (local dev).** `npm run dev`, open a restaurant detail page at a 375px viewport. (Pre-ingest the line is absent — `hours` is undefined; it appears after Task 7's ingest. Confirm no layout shift / no error.) Then commit:

```bash
git add src/components/RestaurantDetail.tsx
git commit -m "feat(detail): honest open-now line with today's hours"
```

---

### Task 7: Full re-ingest + final verification

**Files:** none (data regeneration + gate).

**Interfaces:** Consumes the whole pipeline. Produces populated `hours` in `restaurants.generated.json`, absent from `restaurants.core.json`.

- [ ] **Step 1: Confirm the key is present.** Run: `node -e "require('dotenv').config(); console.log(!!process.env.GOOGLE_PLACES_API_KEY)"`. Expected: `true`. (If false, stop — the live ingest needs `GOOGLE_PLACES_API_KEY` in `.env`.)

- [ ] **Step 2: Bust the cache + re-ingest.** The cache is keyed by placeId and would reuse hours-less responses. Run:

```bash
rm -rf scripts/.ingest-cache
npm run ingest
```

Expected: searches run, writes `Wrote <N> restaurants` then `Wrote <N> core records`. (Editorial is re-read from cache if `ANTHROPIC_API_KEY` is set, else templated — orthogonal to hours.)

- [ ] **Step 3: Validate + spot-check.**

```bash
npm run validate-data
npx tsx scripts/hours.check.ts
npx tsx scripts/derive.check.ts
node -e "const f=require('./src/lib/restaurants.generated.json'); const c=require('./src/lib/restaurants.core.json'); const withHours=f.filter(r=>r.hours).length; console.log('full with hours:', withHours, '/', f.length); console.log('core has hours field:', c.some(r=>r.hours));"
```

Expected: `validate-data ok`; both checks print ok; `full with hours` is a large majority of records; `core has hours field: false`.

- [ ] **Step 4: Final gate.**

```bash
npm run typecheck
npm run build
```

Expected: both pass, 15 routes.

- [ ] **Step 5: Live 375px pass.** `npm run dev`; on a detail page confirm the open/closed line now renders with today's hours; in the concierge ask "what's good and open near me right now" and confirm the reply prefers open spots and ends with the Google-hours caveat.

- [ ] **Step 6: Commit the regenerated data.**

```bash
git add src/lib/restaurants.generated.json src/lib/restaurants.core.json
git commit -m "data: re-ingest with Google opening hours"
```

---

## Post-implementation

- Update `docs/feature-timeline.md` with a line for the shipped feature, and add a `docs/decisions/` record (the `hours`-in-`full`-only call, open-now as a steer-not-filter, honesty caveat) — these are non-obvious and likely to be re-litigated, per the project's docs norm.
- Before merging to `main`: `git fetch origin`, rebase onto the latest `main` (the "Discover home" merge has landed in parallel), resolve any `parseQuery`/`recommend.ts` overlap, re-run the gate, then integrate via the finishing-a-development-branch skill.

## Self-review notes

- **Spec coverage:** data shape (T1), `isOpenNow`/`todayHoursText` (T1), parseQuery/mergeCravings/scorer (T2), ingest mask+derive (T3), attach/strip/validate (T4), concierge route+client (T5), detail line (T6), re-ingest+gate (T7). All spec sections map to a task.
- **Type consistency:** `OpeningHours` fields (`periods{openDay,openMin,closeDay,closeMin}`, `weekdayText`, `utcOffsetMinutes`), `OpenState`, `isOpenNow`, `todayHoursText`, `hoursFrom` names/signatures are identical across tasks.
- **No placeholders:** every code step shows real code; every run step shows the command + expected output.
