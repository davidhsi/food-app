"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { useStore } from "@/lib/store";
import { getRestaurant } from "@/lib/data";
import { StarIcon } from "@/components/icons";

function scoreColor(s: number) {
  if (s >= 8.5) return "text-emerald-400";
  if (s >= 7) return "text-lime-400";
  if (s >= 5.5) return "text-yellow-400";
  return "text-orange-400";
}

export default function ProfilePage() {
  const { profile, ranked, saved, liked, reset, removeRanked } = useStore();
  const [tab, setTab] = useState<"been" | "want">("been");

  const beenSorted = useMemo(
    () => [...ranked].sort((a, b) => b.score - a.score),
    [ranked],
  );

  return (
    <AppShell>
      <div className="h-full overflow-y-auto pb-24">
        {/* Header */}
        <div className="bg-gradient-to-b from-brand/30 to-transparent px-5 pt-10 pb-4">
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-brand text-2xl font-black ring-2 ring-white/20">
              🍴
            </div>
            <div>
              <h1 className="text-xl font-extrabold">Your Taste</h1>
              <p className="text-sm text-white/60">
                {ranked.length} ranked · {saved.length} saved · {liked.length}{" "}
                liked
              </p>
            </div>
          </div>

          {/* Taste chips */}
          <div className="mt-4 flex flex-wrap gap-1.5">
            {profile.cuisines.slice(0, 5).map((c) => (
              <span
                key={c}
                className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium ring-1 ring-white/10"
              >
                {c}
              </span>
            ))}
            {profile.vibes.slice(0, 3).map((v) => (
              <span
                key={v}
                className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium ring-1 ring-white/10"
              >
                {v.replace("-", " ")}
              </span>
            ))}
            <Link
              href="/onboarding"
              className="rounded-full bg-brand/20 px-2.5 py-1 text-[11px] font-semibold text-brand-glow ring-1 ring-brand/30"
            >
              Edit taste
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="sticky top-0 z-10 flex gap-1 border-b border-white/10 bg-ink/90 px-5 backdrop-blur">
          {(
            [
              ["been", `Been (${ranked.length})`],
              ["want", `Want to try (${saved.length})`],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`relative py-3 text-sm font-semibold transition-colors ${
                tab === k ? "text-white" : "text-white/45"
              }`}
              style={{ marginRight: 20 }}
            >
              {label}
              {tab === k && (
                <span className="absolute inset-x-0 -bottom-px h-0.5 rounded bg-brand" />
              )}
            </button>
          ))}
        </div>

        {/* Lists */}
        <div className="px-4 pt-3">
          {tab === "been" &&
            (beenSorted.length === 0 ? (
              <Empty
                emoji="📈"
                title="No rankings yet"
                body="Tap the + on any reel to rank a spot you've been to. We'll build your personal leaderboard."
              />
            ) : (
              <ol className="space-y-2">
                {beenSorted.map((e, i) => {
                  const r = getRestaurant(e.restaurantId);
                  if (!r) return null;
                  return (
                    <li key={e.restaurantId}>
                      <Link
                        href={`/restaurant/${r.id}`}
                        className="flex items-center gap-3 rounded-2xl bg-white/5 p-2.5 ring-1 ring-white/10 active:scale-[0.99]"
                      >
                        <span className="w-5 text-center text-sm font-black text-white/40">
                          {i + 1}
                        </span>
                        <div
                          className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-xl"
                          style={{
                            background: `linear-gradient(150deg, ${r.reels[0].gradient[0]}, ${r.reels[0].gradient[1]})`,
                          }}
                        >
                          {r.reels[0].emoji}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-bold">
                            {r.name}
                          </div>
                          <div className="truncate text-xs text-white/55">
                            {r.cuisines[0]} · {r.neighborhood}
                          </div>
                        </div>
                        <div
                          className={`text-lg font-black ${scoreColor(e.score)}`}
                        >
                          {e.score.toFixed(1)}
                        </div>
                        <button
                          onClick={(ev) => {
                            ev.preventDefault();
                            removeRanked(r.id);
                          }}
                          className="px-1 text-white/30 hover:text-white/70"
                        >
                          ✕
                        </button>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            ))}

          {tab === "want" &&
            (saved.length === 0 ? (
              <Empty
                emoji="🔖"
                title="Nothing saved yet"
                body="Tap the bookmark on a reel to save places you want to try."
              />
            ) : (
              <div className="space-y-2">
                {saved.map((id) => {
                  const r = getRestaurant(id);
                  if (!r) return null;
                  return (
                    <Link
                      key={id}
                      href={`/restaurant/${r.id}`}
                      className="flex items-center gap-3 rounded-2xl bg-white/5 p-2.5 ring-1 ring-white/10 active:scale-[0.99]"
                    >
                      <div
                        className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-xl"
                        style={{
                          background: `linear-gradient(150deg, ${r.reels[0].gradient[0]}, ${r.reels[0].gradient[1]})`,
                        }}
                      >
                        {r.reels[0].emoji}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold">
                          {r.name}
                        </div>
                        <div className="truncate text-xs text-white/55">
                          {r.cuisines.join(" · ")} · {"$".repeat(r.price)}
                        </div>
                      </div>
                      <span className="flex items-center gap-1 text-xs text-brand-glow">
                        <StarIcon filled width={12} height={12} />
                        {r.rating.toFixed(1)}
                      </span>
                    </Link>
                  );
                })}
              </div>
            ))}

          <button
            onClick={() => {
              if (confirm("Reset your taste profile and all lists?")) reset();
            }}
            className="mt-8 w-full rounded-xl py-3 text-center text-xs font-medium text-white/30"
          >
            Reset profile
          </button>
        </div>
      </div>
    </AppShell>
  );
}

function Empty({
  emoji,
  title,
  body,
}: {
  emoji: string;
  title: string;
  body: string;
}) {
  return (
    <div className="mt-12 px-6 text-center">
      <div className="text-5xl">{emoji}</div>
      <h3 className="mt-3 font-bold">{title}</h3>
      <p className="mt-1 text-sm text-white/50">{body}</p>
    </div>
  );
}
