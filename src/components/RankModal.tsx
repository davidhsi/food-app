"use client";

import { useMemo, useState } from "react";
import { Restaurant } from "@/lib/types";
import { getRestaurant } from "@/lib/data";
import { useStore } from "@/lib/store";
import {
  RankingSession,
  recordComparison,
  startRanking,
} from "@/lib/ranking";

/**
 * Beli-style ranking flow. Asks "first impression" then runs pairwise
 * comparisons against the user's existing ranked list to find the insert point.
 */
export default function RankModal({
  restaurant,
  onClose,
}: {
  restaurant: Restaurant;
  onClose: () => void;
}) {
  const ranked = useStore((s) => s.ranked);
  const addRanked = useStore((s) => s.addRanked);

  // bucket determines which slice of the list we compare against first
  const [bucket, setBucket] = useState<null | "loved" | "ok" | "meh">(null);
  const [session, setSession] = useState<RankingSession | null>(null);

  const sortedDesc = useMemo(
    () => [...ranked].sort((a, b) => b.score - a.score),
    [ranked],
  );

  const finish = (s: RankingSession) => {
    addRanked(s.candidateId, s.insertAt);
    onClose();
  };

  const begin = (b: "loved" | "ok" | "meh") => {
    setBucket(b);
    // Narrow the comparison window by first impression for fewer comparisons.
    let pool = sortedDesc;
    let offset = 0;
    if (sortedDesc.length >= 3) {
      const third = Math.ceil(sortedDesc.length / 3);
      if (b === "loved") pool = sortedDesc.slice(0, third);
      else if (b === "ok") {
        offset = third;
        pool = sortedDesc.slice(third, third * 2);
      } else {
        offset = third * 2;
        pool = sortedDesc.slice(third * 2);
      }
    }
    if (pool.length === 0) {
      addRanked(restaurant.id, offset);
      onClose();
      return;
    }
    const s = startRanking(restaurant.id, pool);
    // remember offset so insertAt maps back to the full list
    const adjusted = { ...s, lo: s.lo, hi: s.hi };
    (adjusted as any).__offset = offset;
    (adjusted as any).__poolLen = pool.length;
    setSession(adjusted);
    if (adjusted.done) finish({ ...adjusted, insertAt: offset + adjusted.insertAt });
  };

  const answer = (preferred: boolean) => {
    if (!session) return;
    const next = recordComparison(session, preferred);
    const offset = (session as any).__offset ?? 0;
    if (next.done) {
      finish({ ...next, insertAt: offset + next.insertAt });
    } else {
      (next as any).__offset = offset;
      setSession(next);
    }
  };

  // session.pivot is an index into the sliced pool; map back to the full list.
  const pivotRestaurant =
    session && !session.done
      ? getRestaurant(
          sortedDesc[((session as any).__offset ?? 0) + session.pivot]
            ?.restaurantId ?? "",
        )
      : null;

  return (
    <div
      className="absolute inset-0 z-50 flex items-end justify-center bg-ink/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-3xl border-t border-line bg-paper-raised p-5 pb-8 animate-floatUp"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />

        {!bucket && (
          <>
            <h3 className="font-display text-center text-lg font-bold text-ink">
              How was <span className="text-olive">{restaurant.name}</span>?
            </h3>
            <p className="mt-1 text-center text-sm text-ink-soft">
              We&apos;ll rank it against your list, Beli-style.
            </p>
            <div className="mt-5 grid grid-cols-3 gap-2.5">
              {[
                { k: "loved", t: "Loved it" },
                { k: "ok", t: "It was OK" },
                { k: "meh", t: "Not great" },
              ].map((o) => (
                <button
                  key={o.k}
                  onClick={() => begin(o.k as any)}
                  className="rounded-2xl bg-paper py-4 ring-1 ring-line transition hover:bg-paper-raised active:scale-95"
                >
                  <div className="text-sm font-semibold text-ink">
                    {o.t}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {bucket && session && !session.done && pivotRestaurant && (
          <>
            <h3 className="font-display text-center text-base font-bold text-ink">
              Which did you like more?
            </h3>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[restaurant, pivotRestaurant].map((opt, i) => (
                <button
                  key={opt.id}
                  onClick={() => answer(i === 0)}
                  className="rounded-2xl bg-paper p-4 text-left ring-1 ring-line transition hover:bg-paper-raised active:scale-95"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={opt.reels[0]?.poster}
                    alt={opt.name}
                    className="h-16 w-full rounded-lg object-cover bg-line"
                  />
                  <div className="mt-2 text-sm font-bold leading-tight text-ink">
                    {opt.name}
                  </div>
                  <div className="text-xs text-ink-soft">
                    {opt.cuisines[0]} · {"$".repeat(opt.price)}
                  </div>
                  {i === 0 && (
                    <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-olive">
                      New
                    </div>
                  )}
                </button>
              ))}
            </div>
            <p className="mt-4 text-center text-xs text-ink-faint">
              Comparing to refine your ranking…
            </p>
          </>
        )}
      </div>
    </div>
  );
}
