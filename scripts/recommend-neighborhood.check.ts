import assert from "node:assert";
import { RESTAURANTS } from "../src/lib/data";
import { scoreRestaurant, type SignalState } from "../src/lib/recommend";

const base: SignalState = {
  profile: {
    cuisines: [],
    price: [1, 2, 3],
    vibes: [],
    dietary: [],
    spiceTolerance: 1,
    adventurousness: 0.5,
    undergroundBias: 0.7,
  },
  liked: [],
  saved: [],
  ranked: [],
};

const r = RESTAURANTS[0];

// Selecting a spot's own neighborhood raises its score and adds an "In X" reason.
const without = scoreRestaurant(r, base);
const withHood = scoreRestaurant(r, { ...base, neighborhood: r.neighborhood });
assert.ok(
  withHood.precise > without.precise,
  "own-neighborhood selection should raise the score",
);
assert.ok(
  withHood.reasons.some((x) => x.label === `In ${r.neighborhood}`),
  "exact match should add an 'In <neighborhood>' reason",
);

// A spot in a different neighborhood gets no "In ..." reason (not an exact match).
const other = RESTAURANTS.find((x) => x.neighborhood !== r.neighborhood)!;
const otherScored = scoreRestaurant(other, {
  ...base,
  neighborhood: r.neighborhood,
});
assert.ok(
  !otherScored.reasons.some((x) => x.label === `In ${r.neighborhood}`),
  "non-matching spot should not get an In-<neighborhood> reason",
);

// The steer never drops a score below its un-steered value (never negative).
assert.ok(
  otherScored.precise >= scoreRestaurant(other, base).precise - 1e-9,
  "soft steer is never negative",
);

console.log("recommend-neighborhood.check.ts: OK");
