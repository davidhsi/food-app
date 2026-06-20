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
