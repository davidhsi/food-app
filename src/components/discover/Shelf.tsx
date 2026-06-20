"use client";

import { Restaurant } from "@/lib/types";
import ShelfCard from "./ShelfCard";

/**
 * A titled, horizontally-scrolling carousel of ShelfCards — one editorial row
 * on the Discover home. Pure presentation; the slicing/labeling lives in
 * `buildShelves` (src/lib/shelves.ts).
 */
export default function Shelf({
  title,
  restaurants,
}: {
  title: string;
  restaurants: Restaurant[];
}) {
  if (restaurants.length === 0) return null;
  return (
    <section className="mb-7">
      <h2 className="px-5 font-display text-lg font-semibold text-ink">
        {title}
      </h2>
      <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto px-5 [mask-image:linear-gradient(to_right,black_96%,transparent)]">
        {restaurants.map((r) => (
          <ShelfCard key={r.id} restaurant={r} />
        ))}
      </div>
    </section>
  );
}
