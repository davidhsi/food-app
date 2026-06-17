import assert from "node:assert";
import {
  buildLocalOrderGuide,
  dishAllergenFlags,
  sanitizePicks,
  orderGuideToReply,
} from "../src/lib/order";
import { Restaurant, TasteProfile } from "../src/lib/types";

/**
 * Pure-logic checks for the "ordering for you" engine. Run:
 *   npx tsx scripts/order.check.ts
 * Not wired into an npm script (consistent with the no-test-runner convention).
 */

const baseProfile: TasteProfile = {
  cuisines: ["Thai"],
  price: [1, 2, 3],
  vibes: [],
  dietary: [],
  allergies: ["shellfish", "peanuts"],
  spiceTolerance: 2,
  adventurousness: 0.5,
  undergroundBias: 0.7,
};

const r: Restaurant = {
  id: "x",
  name: "Test Thai",
  cuisines: ["Thai"],
  price: 2,
  rating: 9,
  popularity: 0.5,
  buzz: 0.3,
  neighborhood: "Test",
  city: "Chicago",
  lat: 0,
  lng: 0,
  distanceKm: 1,
  vibes: [],
  dietary: [],
  spice: 2,
  tags: [],
  signatureDishes: ["Shrimp Pad Thai", "Peanut Satay Skewers", "Green Curry"],
  reels: [],
};

// 1. Keyword flags are conservative and name-based.
assert.deepStrictEqual(dishAllergenFlags("Shrimp Pad Thai").sort(), ["shellfish"]);
assert.deepStrictEqual(dishAllergenFlags("Peanut Satay Skewers").sort(), ["peanuts"]);
assert.deepStrictEqual(dishAllergenFlags("Green Curry"), []);

// 2. Local guide caps at 3 picks and attaches only the user's own allergens.
const guide = buildLocalOrderGuide(r, baseProfile);
assert.strictEqual(guide.picks.length, 3);
assert.deepStrictEqual(guide.picks[0].cautions, ["shellfish"]);
assert.deepStrictEqual(guide.picks[1].cautions, ["peanuts"]);
assert.strictEqual(guide.picks[2].cautions, undefined);

// 3. A user with no allergies gets no cautions.
const noAllergy = buildLocalOrderGuide(r, { ...baseProfile, allergies: [] });
assert.ok(noAllergy.picks.every((p) => !p.cautions));

// 4. sanitizePicks drops invented dishes and only keeps the user's allergens,
//    unioning model cautions with the keyword scan.
const cleaned = sanitizePicks(
  [
    { dish: "shrimp pad thai", why: "great", cautions: ["shellfish", "wheat"] },
    { dish: "Totally Invented Dish", why: "nope" },
  ],
  r.signatureDishes,
  baseProfile.allergies!,
);
assert.strictEqual(cleaned.length, 1);
assert.strictEqual(cleaned[0].dish, "Shrimp Pad Thai"); // canonical spelling
assert.deepStrictEqual(cleaned[0].cautions, ["shellfish"]); // "wheat" not user's allergy

// 5. Reply weaves in a caution.
const reply = orderGuideToReply("Test Thai", guide);
assert.ok(reply.includes("Test Thai"));
assert.ok(/may contain shellfish/.test(reply));

console.log("order.check.ts: all assertions passed");
