import assert from "node:assert/strict";
import { coerce, generateEditorial } from "./editorial";

const input = {
  name: "Ramen Koba",
  cuisines: ["Japanese" as const],
  price: 2 as const,
  rating: 9.4,
  reviewCount: 180,
  reviewSnippets: ["Best ramen in Avondale.", "Only 9 seats, go early."],
};

const run = async () => {
  const ed = await generateEditorial(input, undefined); // no key -> deterministic
  assert.ok(ed.blurb.length > 0, "blurb non-empty");
  assert.ok(ed.insiderTip.length > 0, "insiderTip non-empty");
  assert.ok(Array.isArray(ed.signatureDishes));
  // Keyless fallback yields no editorial dishes -> no topDishes.
  assert.deepEqual(ed.topDishes, [], "fallback topDishes empty");
  assert.ok(ed.spice >= 0 && ed.spice <= 3, "spice in 0..3");
  for (const v of ed.vibes) {
    assert.ok(
      ["trendy", "cozy", "casual", "fine-dining", "late-night", "date-night", "group-friendly", "outdoor", "quick-bite", "hidden-gem"].includes(v),
      "vibe in union: " + v,
    );
  }
  assert.ok(Array.isArray(ed.cuisines) && ed.cuisines.length > 0, "cuisines non-empty");
  // no-key fallback returns the hint cuisines unchanged
  assert.deepEqual(ed.cuisines, ["Japanese"]);

  // coerce(): topDishes must be a ranked subset of signatureDishes, capped at 3,
  // with invented dishes dropped and canonical spelling preserved.
  const coerced = coerce(
    {
      blurb: "x",
      insiderTip: "y",
      signatureDishes: ["Tonkotsu Ramen", "Gyoza", "Spicy Miso"],
      topDishes: [
        { dish: "tonkotsu ramen", note: "rich and silky" }, // case-normalized match
        { dish: "Totally Invented Dish", note: "nope" }, // dropped
        { dish: "Gyoza" }, // no note ok
        { dish: "Spicy Miso", note: "a" },
        { dish: "Tonkotsu Ramen", note: "dup" }, // dedup dropped
      ],
    },
    input,
  );
  assert.equal(coerced.topDishes.length, 3, "topDishes capped at 3");
  assert.deepEqual(
    coerced.topDishes.map((t) => t.dish),
    ["Tonkotsu Ramen", "Gyoza", "Spicy Miso"],
    "invented + dup dropped, canonical spelling kept, order preserved",
  );
  assert.equal(coerced.topDishes[0].note, "rich and silky");
  assert.equal(coerced.topDishes[1].note, undefined, "missing note stays undefined");

  console.log("editorial.check ok");
};
run();
