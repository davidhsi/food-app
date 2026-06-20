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
