import fs from "fs";
import path from "path";
import { Restaurant } from "../src/lib/types";

/**
 * Splits the full generated dataset into a client-safe "core" dataset.
 *
 * The detail-only editorial fields below are shown ONLY on the restaurant detail
 * page — never in the feed, cards, search, or the recommendation scorer. The
 * detail page loads them per-record from the server (`src/lib/data.server.ts`),
 * so they don't need to ship in the client bundle. Dropping them keeps the
 * full record as the single source of truth while shrinking what every other
 * screen downloads.
 *
 * Run standalone with `npm run split-data`; also invoked at the end of
 * `npm run ingest`. CommonJS, consistent with the rest of `scripts/`.
 */
export const DETAIL_ONLY_FIELDS = ["insiderTip", "blurb"] as const;

const SRC = path.join(process.cwd(), "src", "lib", "restaurants.generated.json");
const CORE_OUT = path.join(process.cwd(), "src", "lib", "restaurants.core.json");

export function toCore(r: Restaurant): Omit<Restaurant, "insiderTip" | "blurb"> {
  const core: Record<string, unknown> = { ...r };
  for (const f of DETAIL_ONLY_FIELDS) delete core[f];
  return core as Omit<Restaurant, "insiderTip" | "blurb">;
}

export function writeCoreDataset(restaurants: Restaurant[]): void {
  const core = restaurants.map(toCore);
  fs.writeFileSync(CORE_OUT, JSON.stringify(core, null, 2) + "\n", "utf8");
  console.log(`Wrote ${core.length} core records to ${CORE_OUT}`);
}

function main(): void {
  const full = JSON.parse(fs.readFileSync(SRC, "utf8")) as Restaurant[];
  writeCoreDataset(full);
}

// Run when invoked directly (npx tsx scripts/split-data.ts), not when imported.
if (require.main === module) main();
