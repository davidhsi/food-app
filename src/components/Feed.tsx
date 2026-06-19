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

  // Scroll the nearest scrollable ancestor (AppShell scrolls per-page, not the
  // window) back to the top.
  const backToTop = (e: React.MouseEvent<HTMLButtonElement>) => {
    let el: HTMLElement | null = e.currentTarget;
    while (el && el !== document.body) {
      const oy = getComputedStyle(el).overflowY;
      if ((oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight) {
        el.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      el = el.parentElement;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

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
        <div className="mb-6 mt-2 rounded-2xl border border-line bg-paper-raised px-5 py-6 text-center">
          <div className="font-display text-base font-semibold text-ink">
            You&apos;re all caught up
          </div>
          <p className="mt-1 text-[13px] text-ink-soft">
            That&apos;s every gem for now — come back tomorrow for more.
          </p>
          <button
            type="button"
            onClick={backToTop}
            className="mt-4 rounded-full bg-paper px-4 py-2 text-sm font-medium text-ink-soft ring-1 ring-line active:scale-95"
          >
            Back to top
          </button>
        </div>
      )}
    </div>
  );
}
