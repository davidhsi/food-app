"use client";

import { useState } from "react";
import { Restaurant } from "@/lib/types";
import { useStore } from "@/lib/store";
import { RankingSession, recordComparison, startRanking } from "@/lib/ranking";
import { PlusIcon, StarIcon, XIcon } from "./icons";

/** Personal score color, mirroring profile/page.tsx. */
function scoreColor(s: number) {
  if (s >= 8.5) return "text-olive";
  if (s >= 7) return "text-olive-deep";
  if (s >= 5.5) return "text-ink-soft";
  return "text-ink-faint";
}

/**
 * "Your picks here" — a local-only personal ranking of the dishes you've had at
 * this restaurant. Reuses the Beli-style pairwise engine (ranking.ts) so it feels
 * like ranking restaurants. Strictly personal: no cross-user claims, no counts.
 * Hidden when the spot has fewer than two signature dishes (nothing to rank).
 */
export default function DishRanker({ restaurant: r }: { restaurant: Restaurant }) {
  const ranks = useStore((s) => s.dishRanks[r.id]) ?? [];
  const rankDish = useStore((s) => s.rankDish);
  const removeDishRank = useStore((s) => s.removeDishRank);

  const [session, setSession] = useState<RankingSession | null>(null);
  const [candidate, setCandidate] = useState<string | null>(null);

  if (r.signatureDishes.length < 2) return null;

  const sortedDesc = [...ranks].sort((a, b) => b.score - a.score);
  const rankedNames = new Set(sortedDesc.map((e) => e.dish));
  const unranked = r.signatureDishes.filter((d) => !rankedNames.has(d));

  const startFor = (dish: string) => {
    const s = startRanking(dish, sortedDesc);
    if (s.done) {
      rankDish(r.id, dish, s.insertAt); // first dish, or empty list
      return;
    }
    setCandidate(dish);
    setSession(s);
  };

  const answer = (preferredCandidate: boolean) => {
    if (!session || !candidate) return;
    const next = recordComparison(session, preferredCandidate);
    if (next.done) {
      rankDish(r.id, candidate, next.insertAt);
      setSession(null);
      setCandidate(null);
    } else {
      setSession(next);
    }
  };

  const pivotDish =
    session && !session.done ? sortedDesc[session.pivot]?.dish ?? null : null;

  return (
    <div className="px-5 pt-5">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink-faint">
        <StarIcon width={15} height={15} /> Your picks here
      </h2>
      <p className="mt-0.5 text-xs text-ink-faint">
        Rank the dishes you&apos;ve tried — just for you.
      </p>

      {/* Active pairwise comparison */}
      {candidate && pivotDish ? (
        <div className="mt-3 rounded-2xl border border-line bg-paper-raised p-4 animate-floatUp">
          <h3 className="text-center text-sm font-semibold text-ink">
            Which did you like more?
          </h3>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {[candidate, pivotDish].map((dish, i) => (
              <button
                key={dish}
                type="button"
                onClick={() => answer(i === 0)}
                className="rounded-xl bg-paper p-3 text-left ring-1 ring-line transition hover:bg-paper-raised active:scale-95"
              >
                <div className="text-sm font-semibold leading-tight text-ink">
                  {dish}
                </div>
                {i === 0 && (
                  <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-olive">
                    New
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Your ranked top 3 */}
          {sortedDesc.length > 0 && (
            <ol className="mt-3 space-y-2">
              {sortedDesc.slice(0, 3).map((e, i) => (
                <li
                  key={e.dish}
                  className="flex items-center gap-3 rounded-2xl border border-line bg-paper-raised px-3.5 py-2.5"
                >
                  <span className="w-4 text-center text-sm font-semibold text-ink-faint">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                    {e.dish}
                  </span>
                  <span className={`text-base font-semibold ${scoreColor(e.score)}`}>
                    {e.score.toFixed(1)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeDishRank(r.id, e.dish)}
                    aria-label={`Remove ${e.dish}`}
                    className="text-ink-faint hover:text-ink-soft"
                  >
                    <XIcon width={14} height={14} />
                  </button>
                </li>
              ))}
            </ol>
          )}

          {/* Add a dish you've had */}
          {unranked.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {unranked.map((dish) => (
                <button
                  key={dish}
                  type="button"
                  onClick={() => startFor(dish)}
                  className="inline-flex items-center gap-1 rounded-full bg-paper-raised px-3 py-1.5 text-xs font-medium text-ink-soft ring-1 ring-line transition hover:bg-line/40 active:scale-95"
                >
                  <PlusIcon width={13} height={13} /> {dish}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
