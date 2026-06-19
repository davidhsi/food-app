"use client";

import { useEffect, useState } from "react";
import { Restaurant } from "@/lib/types";
import SpotCard from "./SpotCard";

const PAGE = 24;

export default function Feed({
  restaurants,
  emptyLabel = "Nothing to show yet.",
}: {
  restaurants: Restaurant[];
  emptyLabel?: string;
}) {
  // Render the list in pages so we don't mount ~1.6k cards (and fire ~1.6k
  // photo requests) at once. Reset the window whenever the list itself changes
  // (e.g. neighborhood switch or new recommendations).
  const [visible, setVisible] = useState(PAGE);
  useEffect(() => {
    setVisible(PAGE);
  }, [restaurants]);

  if (restaurants.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center p-8 text-center text-ink-soft">
        {emptyLabel}
      </div>
    );
  }

  const shown = restaurants.slice(0, visible);
  const hasMore = visible < restaurants.length;

  return (
    <div className="px-4">
      {shown.map((r) => (
        <SpotCard key={r.id} restaurant={r} />
      ))}
      {hasMore ? (
        <button
          type="button"
          onClick={() => setVisible((v) => v + PAGE)}
          className="mb-6 mt-1 w-full rounded-full bg-paper px-4 py-3 text-sm font-medium text-ink-soft ring-1 ring-line active:scale-[0.98]"
        >
          Show more gems
        </button>
      ) : (
        <p className="pb-6 pt-2 text-center text-[13px] text-ink-faint">
          You&apos;re all caught up — come back tomorrow for more gems.
        </p>
      )}
    </div>
  );
}
