import assert from "node:assert";
import {
  NEIGHBORHOODS,
  nearestNeighborhood,
  neighborhoodCentroid,
} from "../src/lib/neighborhoods";

// At least the 9 original neighborhoods (data-derived; a pulled area that
// yields no qualifying spots simply won't appear), in sorted order.
assert.ok(NEIGHBORHOODS.length >= 9, "expected at least 9 neighborhoods");
assert.deepStrictEqual(
  [...NEIGHBORHOODS].sort(),
  NEIGHBORHOODS,
  "NEIGHBORHOODS should be sorted",
);

// Every neighborhood has a plausible Chicago centroid.
for (const n of NEIGHBORHOODS) {
  const c = neighborhoodCentroid(n);
  assert.ok(c, `centroid exists for ${n}`);
  assert.ok(c!.lat > 41 && c!.lat < 42, `lat plausible for ${n}`);
  assert.ok(c!.lng > -88 && c!.lng < -87, `lng plausible for ${n}`);
}

// nearestNeighborhood maps a centroid back to its own neighborhood.
for (const n of NEIGHBORHOODS) {
  const c = neighborhoodCentroid(n)!;
  assert.strictEqual(
    nearestNeighborhood(c.lat, c.lng),
    n,
    `nearest to ${n}'s centroid is ${n}`,
  );
}

console.log("neighborhoods.check.ts: OK");
