import fs from "fs";
import path from "path";

const DIR = path.join(process.cwd(), "scripts", ".ingest-cache");

function pathFor(placeId: string): string {
  const safe = placeId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(DIR, `${safe}.json`);
}

export function readCache<T = unknown>(placeId: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(pathFor(placeId), "utf8")) as T;
  } catch {
    return null;
  }
}

export function writeCache(placeId: string, data: unknown): void {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(pathFor(placeId), JSON.stringify(data), "utf8");
}
