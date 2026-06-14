"use client";

import { Restaurant } from "@/lib/types";
import SpotCard from "./SpotCard";

export default function Feed({
  restaurants,
  emptyLabel = "Nothing to show yet.",
}: {
  restaurants: Restaurant[];
  emptyLabel?: string;
}) {
  if (restaurants.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center p-8 text-center text-ink-soft">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="px-4">
      {restaurants.map((r) => (
        <SpotCard key={r.id} restaurant={r} />
      ))}
      <p className="pb-6 pt-2 text-center text-[13px] text-ink-faint">
        You&apos;re all caught up — come back tomorrow for more gems.
      </p>
    </div>
  );
}
