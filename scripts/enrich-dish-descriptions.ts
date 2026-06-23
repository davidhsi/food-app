import "dotenv/config";
import fs from "fs";
import path from "path";
import { Restaurant } from "../src/lib/types";
import { generateDishDescriptions } from "./editorial";
import { writeCoreDataset } from "./split-data";

/**
 * Ordering Phase 3 — populate `Restaurant.dishDescriptions` (the rich, dish-centric
 * copy the detail-page order guide renders instantly). See
 * `docs/decisions/2026-06-21-prestored-dish-descriptions.md`.
 *
 * This is a **surgical, idempotent** pass over the EXISTING generated dataset: it
 * adds ONLY `dishDescriptions` and re-derives `core`. We deliberately do NOT route
 * this through `npm run ingest` — a full ingest re-pulls Places and regenerates all
 * editorial (blurb/tips/topDishes), which (Haiku being non-deterministic) would
 * churn already-good copy just to add one field.
 *
 * Needs `ANTHROPIC_API_KEY` in `.env`; without it nothing is written (the guide
 * falls back to the local taste line, no description). CommonJS, consistent with
 * the rest of `scripts/` (do NOT add `scripts/package.json` with type:module).
 *
 *   npx tsx scripts/enrich-dish-descriptions.ts            # all un-enriched records
 *   npx tsx scripts/enrich-dish-descriptions.ts --limit 10 # first 10 (cheap test)
 *   npx tsx scripts/enrich-dish-descriptions.ts --force    # re-generate even if present
 */

const SRC = path.join(process.cwd(), "src", "lib", "restaurants.generated.json");

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

/** The dishes the order guide actually shows: topDishes (≤3) else first 3 signature. */
function dishesToDescribe(r: Restaurant): string[] {
  return r.topDishes?.length
    ? r.topDishes.slice(0, 3).map((t) => t.dish)
    : r.signatureDishes.slice(0, 3);
}

async function main(): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error(
      "No ANTHROPIC_API_KEY in .env — nothing to do (dish descriptions need a key).",
    );
    process.exit(1);
  }

  const force = process.argv.includes("--force");
  const limitRaw = arg("--limit");
  const limit = limitRaw ? Math.max(0, parseInt(limitRaw, 10)) : Infinity;

  const all = JSON.parse(fs.readFileSync(SRC, "utf8")) as Restaurant[];

  // Candidates: records that have dishes to describe and aren't already enriched
  // (unless --force). Idempotent — re-running only fills the gaps.
  const candidates = all.filter(
    (r) =>
      dishesToDescribe(r).length > 0 &&
      (force || !r.dishDescriptions?.length),
  );
  const targets = candidates.slice(0, limit);
  console.log(
    `enrich-dishes: ${targets.length} of ${candidates.length} un-enriched records ` +
      `(of ${all.length} total)${limit !== Infinity ? `, capped at ${limit}` : ""}.`,
  );

  // Write the full dataset back (and re-derive the client core — detail-only field
  // is stripped there, see split-data DETAIL_ONLY_FIELDS). Called periodically so a
  // crash/timeout mid-run doesn't lose progress; idempotent re-runs resume the rest.
  const flush = () => {
    fs.writeFileSync(SRC, JSON.stringify(all, null, 2) + "\n", "utf8");
    writeCoreDataset(all);
  };

  const CHECKPOINT_EVERY = 25;
  let done = 0;
  let withDesc = 0;
  for (const r of targets) {
    const dishes = dishesToDescribe(r);
    const descriptions = await generateDishDescriptions(
      {
        name: r.name,
        cuisines: r.cuisines,
        price: r.price,
        dishes,
        blurb: r.blurb,
      },
      apiKey,
    );
    if (descriptions.length) {
      r.dishDescriptions = descriptions;
      withDesc++;
    }
    done++;
    if (done % CHECKPOINT_EVERY === 0 || done === targets.length) {
      flush(); // checkpoint to disk
      console.log(
        `  ${done}/${targets.length} processed (${withDesc} got descriptions) — checkpointed`,
      );
    }
  }

  console.log(`Wrote ${all.length} records to ${SRC} (+ core).`);
  console.log("Done. Run `npm run validate-data` to assert invariants.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
