"use client";

import { memo } from "react";
import Link from "next/link";
import { gemScore, Restaurant } from "@/lib/types";
import { useStore } from "@/lib/store";
import { track } from "@/lib/analytics";
import { BookmarkIcon } from "./icons";

const priceStr = (p: number) => "$".repeat(p);

function SpotCard({ restaurant: r }: { restaurant: Restaurant }) {
  const toggleSave = useStore((s) => s.toggleSave);
  const isSaved = useStore((s) => s.saved.includes(r.id));
  const poster = r.reels[0]?.poster;
  const score = (gemScore(r) * 10).toFixed(1);

  return (
    <article className="relative mb-7 animate-floatUp">
      <Link
        href={`/restaurant/${r.id}`}
        className="block w-full text-left"
      >
        <div className="relative h-52 overflow-hidden rounded-[20px] bg-line">
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
          <div className="absolute left-3 top-3 rounded-full bg-ink/75 px-2.5 py-1 text-[11px] font-semibold text-paper backdrop-blur-sm">
            <span className="text-gem">◆</span> {score}
          </div>
        </div>
        <h3 className="mt-3 font-display text-2xl font-semibold leading-tight text-ink">
          {r.name}
        </h3>
        <div className="mt-1.5 text-[13px] text-ink-soft">
          <span className="font-semibold text-olive">★ {r.rating.toFixed(1)}</span>{" "}
          · {r.cuisines.join(" · ")} · {priceStr(r.price)} · {r.neighborhood}
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
        className="absolute right-2.5 top-2.5 grid h-9 w-9 place-items-center rounded-full bg-paper-raised/90 text-ink backdrop-blur-sm active:scale-90 transition-transform"
      >
        <BookmarkIcon filled={isSaved} width={16} height={16} />
      </button>
    </article>
  );
}

// Memoized: the feed re-renders on every store mutation (save, mark-seen,
// profile edit); without this, all visible cards re-render even though only the
// toggled one changed. Restaurant objects are stable identities from the
// dataset, so the default shallow prop compare is correct here.
export default memo(SpotCard);
