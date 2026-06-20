"use client";

import { memo } from "react";
import Link from "next/link";
import { gemScore, Restaurant } from "@/lib/types";
import { useStore } from "@/lib/store";
import { track } from "@/lib/analytics";
import { BookmarkIcon } from "@/components/icons";

/**
 * Compact card for the horizontal shelves on the Discover home — a narrower,
 * lighter cousin of SpotCard (which stays the full-width feed card). Same data
 * surface, same /api/photo poster, same save toggle. Memoized for the same
 * reason as SpotCard: the home re-renders on every store mutation and a single
 * save toggle must not re-render every card in every shelf.
 */
function ShelfCard({ restaurant: r }: { restaurant: Restaurant }) {
  const toggleSave = useStore((s) => s.toggleSave);
  const isSaved = useStore((s) => s.saved.includes(r.id));
  const poster = r.reels[0]?.poster;
  const score = (gemScore(r) * 10).toFixed(1);

  return (
    <article className="relative w-44 shrink-0">
      <Link href={`/restaurant/${r.id}`} className="block text-left">
        <div className="relative h-28 overflow-hidden rounded-2xl bg-line">
          {poster && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={poster}
              alt={r.name}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          )}
          <div
            className="absolute left-2 top-2 rounded-full bg-ink/75 px-2 py-0.5 text-[10px] font-semibold text-paper backdrop-blur-sm"
            aria-label={`Gem score ${score} out of 10`}
          >
            <span className="text-gem" aria-hidden="true">◆</span> {score}
          </div>
        </div>
        <h3 className="mt-2 line-clamp-1 font-display text-[15px] font-semibold leading-tight text-ink">
          {r.name}
        </h3>
        <div className="mt-0.5 line-clamp-1 text-[12px] text-ink-soft">
          <span className="font-semibold text-olive" aria-hidden="true">★</span>{" "}
          {r.rating.toFixed(1)} · {r.cuisines[0]} · {r.neighborhood}
        </div>
      </Link>
      <button
        type="button"
        onClick={() => {
          track("save_toggle", { id: r.id, saved: !isSaved, source: "card" });
          toggleSave(r.id);
        }}
        aria-label={isSaved ? "Remove from want to try" : "Save to want to try"}
        aria-pressed={isSaved}
        className="absolute right-1.5 top-1.5 grid h-9 w-9 place-items-center rounded-full bg-paper-raised/90 text-ink backdrop-blur-sm active:scale-90 transition-transform"
      >
        <BookmarkIcon filled={isSaved} width={14} height={14} />
      </button>
    </article>
  );
}

export default memo(ShelfCard);
