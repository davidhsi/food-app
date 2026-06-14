import assert from "node:assert/strict";
import {
  slugify,
  ratingFrom,
  priceFrom,
  cuisinesFromTypes,
  distanceFromCenterKm,
  buildBuzzNormalizer,
  percentileRank,
} from "./derive";

// slugify: stable, url-safe, suffixed with a placeId tail
assert.equal(slugify("Tony's Coal Oven!", "ChIJ_abc123XYZ"), "tonys-coal-oven-23xyz");

// ratingFrom: 0..5 -> 0..10, default 0
assert.equal(ratingFrom(4.7), 9.4);
assert.equal(ratingFrom(undefined), 0);

// priceFrom: Places enum -> 1..4, default 2
assert.equal(priceFrom("PRICE_LEVEL_INEXPENSIVE"), 1);
assert.equal(priceFrom("PRICE_LEVEL_VERY_EXPENSIVE"), 4);
assert.equal(priceFrom(undefined), 2);

// cuisinesFromTypes: maps fine-grained Places types -> Cuisine union
assert.deepEqual(cuisinesFromTypes(["ramen_restaurant", "restaurant"], "Ramen Koba"), ["Japanese"]);
assert.deepEqual(cuisinesFromTypes(["pizza_restaurant"], "Tony's"), ["Italian"]);
// name fallback when types are unhelpful
assert.deepEqual(cuisinesFromTypes(["restaurant"], "Pho 88"), ["Vietnamese"]);
// last-resort default
assert.deepEqual(cuisinesFromTypes(["restaurant"], "Corner Spot"), ["American"]);

// distanceFromCenterKm: ~0 at center
assert.ok(distanceFromCenterKm(41.8786, -87.6251) < 0.1);

// buzz: min-max over log(count); fewest reviews -> ~0, most -> ~1
const buzz = buildBuzzNormalizer([20, 200, 9000]);
assert.ok(buzz(20) < 0.01);
assert.ok(buzz(9000) > 0.99);
assert.ok(buzz(200) > 0 && buzz(200) < 1);

// percentileRank: 0..1, monotonic
const counts = [10, 50, 100, 5000];
assert.equal(percentileRank(counts, 10), 0);
assert.equal(percentileRank(counts, 5000), 1);

assert.deepEqual(cuisinesFromTypes(["steak_house", "restaurant"], "Gibsons"), ["American"]);
assert.deepEqual(cuisinesFromTypes(["greek_restaurant"], "Athena"), ["Mediterranean"]);
assert.deepEqual(cuisinesFromTypes(["restaurant"], "Kung Fu Tea"), ["Cafe"]);
assert.deepEqual(cuisinesFromTypes(["restaurant"], "Sweet Mandy B's Bakery"), ["Dessert"]);

console.log("derive.check ok");
