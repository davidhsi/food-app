import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { Restaurant } from "../src/lib/types";

const file = path.join(process.cwd(), "src", "lib", "restaurants.generated.json");
const data = JSON.parse(fs.readFileSync(file, "utf8")) as Restaurant[];

assert.ok(Array.isArray(data) && data.length > 0, "non-empty array");

const ids = new Set<string>();
for (const r of data) {
  assert.ok(r.id && !ids.has(r.id), `unique id: ${r.id}`);
  ids.add(r.id);
  assert.ok(r.name, `name on ${r.id}`);
  assert.ok(r.cuisines.length > 0, `cuisines on ${r.id}`);
  assert.ok(r.rating >= 0 && r.rating <= 10, `rating range on ${r.id}`);
  assert.ok(r.buzz >= 0 && r.buzz <= 1, `buzz range on ${r.id}`);
  assert.ok(r.popularity >= 0 && r.popularity <= 1, `popularity range on ${r.id}`);
  assert.ok([1, 2, 3, 4].includes(r.price), `price enum on ${r.id}`);
  assert.ok(Number.isFinite(r.lat) && Number.isFinite(r.lng), `coords on ${r.id}`);
  assert.ok(Number.isFinite(r.distanceKm), `distanceKm on ${r.id}`);
  assert.ok(r.city === "Chicago", `city on ${r.id}`);
  assert.ok(r.reels[0]?.poster !== undefined, `poster on ${r.id}`);
  assert.ok(r.blurb && r.insiderTip, `editorial on ${r.id}`);
  if (r.topDishes) {
    assert.ok(r.topDishes.length <= 3, `topDishes <= 3 on ${r.id}`);
    const dishes = new Set(r.signatureDishes);
    for (const t of r.topDishes) {
      assert.ok(dishes.has(t.dish), `topDish "${t.dish}" in signatureDishes on ${r.id}`);
    }
  }
  if (r.dishDescriptions) {
    const dishes = new Set(r.signatureDishes);
    for (const d of r.dishDescriptions) {
      assert.ok(
        dishes.has(d.dish),
        `dishDescription "${d.dish}" in signatureDishes on ${r.id}`,
      );
      assert.ok(
        typeof d.desc === "string" && d.desc.trim().length > 0,
        `dishDescription desc non-empty on ${r.id}`,
      );
    }
  }
  if (r.hours) {
    assert.ok(Array.isArray(r.hours.periods), `hours.periods array on ${r.id}`);
    assert.ok(typeof r.hours.utcOffsetMinutes === "number", `hours.utcOffsetMinutes on ${r.id}`);
    assert.ok(Array.isArray(r.hours.weekdayText), `hours.weekdayText on ${r.id}`);
  }
}

const neighborhoods = new Set(data.map((r) => r.neighborhood));
console.log(
  `validate-data ok: ${data.length} restaurants across ${neighborhoods.size} neighborhoods`,
);
