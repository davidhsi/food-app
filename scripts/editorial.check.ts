import assert from "node:assert/strict";
import { generateEditorial } from "./editorial";

const run = async () => {
  const ed = await generateEditorial(
    {
      name: "Ramen Koba",
      cuisines: ["Japanese"],
      price: 2,
      rating: 9.4,
      reviewCount: 180,
      reviewSnippets: ["Best ramen in Avondale.", "Only 9 seats, go early."],
    },
    undefined, // no API key -> deterministic fallback
  );
  assert.ok(ed.blurb.length > 0, "blurb non-empty");
  assert.ok(ed.insiderTip.length > 0, "insiderTip non-empty");
  assert.ok(Array.isArray(ed.signatureDishes));
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
  console.log("editorial.check ok");
};
run();
