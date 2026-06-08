"use client";

import { useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import ReelFeed from "@/components/ReelFeed";
import { SearchIcon } from "@/components/icons";
import { RESTAURANTS, ALL_CUISINES } from "@/lib/data";
import { parseQuery, recommend } from "@/lib/recommend";
import { toFeedItems } from "@/lib/feed";
import { useStore } from "@/lib/store";
import { gemScore, Restaurant } from "@/lib/types";

const TRENDING = [
  "hidden gems",
  "hole in the wall",
  "spicy ramen late night",
  "where locals eat",
  "underground date spot",
  "cash only",
];

function matches(r: Restaurant, q: string): boolean {
  const t = q.toLowerCase();
  return (
    r.name.toLowerCase().includes(t) ||
    r.cuisines.some((c) => c.toLowerCase().includes(t)) ||
    r.neighborhood.toLowerCase().includes(t) ||
    r.city.toLowerCase().includes(t) ||
    r.tags.some((tag) => tag.toLowerCase().includes(t)) ||
    r.signatureDishes.some((d) => d.toLowerCase().includes(t))
  );
}

export default function SearchPage() {
  const store = useStore();
  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [cuisine, setCuisine] = useState<string | null>(null);

  const results = useMemo(() => {
    const active = submitted.trim();
    if (!active && !cuisine) return null;

    // Combine literal text match with NL parsing, then rank by taste fit.
    let pool = RESTAURANTS;
    if (cuisine) pool = pool.filter((r) => r.cuisines.includes(cuisine as any));
    const parsed = active ? parseQuery(active) : { keywords: [] };
    if (active) {
      const direct = pool.filter((r) => matches(r, active));
      const byParse = pool.filter((r) => {
        const cu = parsed.cuisines?.some((c) => r.cuisines.includes(c)) ?? false;
        const vi = parsed.vibes?.some((v) => r.vibes.includes(v)) ?? false;
        return cu || vi;
      });
      const merged = Array.from(new Set([...direct, ...byParse]));
      // For underground-intent queries (e.g. "hidden gems"), rank the whole
      // pool by taste rather than returning nothing.
      const undergroundIntent = (parsed.undergroundBias ?? 0) >= 0.5;
      pool = merged.length ? merged : undergroundIntent ? pool : [];
    }

    const scored = recommend(
      {
        profile: {
          ...store.profile,
          undergroundBias:
            parsed.undergroundBias ?? store.profile.undergroundBias,
        },
        liked: store.liked,
        saved: store.saved,
        ranked: store.ranked,
      },
      pool,
    );
    return toFeedItems(scored);
  }, [submitted, cuisine, store.profile, store.liked, store.saved, store.ranked]);

  return (
    <AppShell>
      <div className="relative h-full">
        {/* Search header */}
        <div className="absolute inset-x-0 top-0 z-30 bg-gradient-to-b from-black/90 to-black/0 p-4 pb-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSubmitted(q);
            }}
            className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2.5 ring-1 ring-white/15 backdrop-blur-md"
          >
            <SearchIcon width={18} height={18} className="text-white/60" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search dishes, vibes, places…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-white/40"
            />
            {q && (
              <button
                type="button"
                onClick={() => {
                  setQ("");
                  setSubmitted("");
                }}
                className="text-white/40"
              >
                ✕
              </button>
            )}
          </form>

          <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
            <button
              onClick={() => setCuisine(null)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${
                !cuisine ? "bg-brand text-white" : "bg-white/10 text-white/70"
              }`}
            >
              All
            </button>
            {ALL_CUISINES.map((c) => (
              <button
                key={c}
                onClick={() => setCuisine(cuisine === c ? null : c)}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${
                  cuisine === c
                    ? "bg-brand text-white"
                    : "bg-white/10 text-white/70"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        {results ? (
          <ReelFeed
            items={results}
            emptyLabel={`No matches for "${submitted}". Try another craving.`}
          />
        ) : (
          <div className="h-full overflow-y-auto px-5 pb-24 pt-32">
            <h2 className="text-sm font-semibold text-white/50">
              Trending searches
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {TRENDING.map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setQ(t);
                    setSubmitted(t);
                  }}
                  className="rounded-full bg-white/5 px-4 py-2 text-sm text-white/85 ring-1 ring-white/10 active:scale-95"
                >
                  {t}
                </button>
              ))}
            </div>

            <h2 className="mt-8 text-sm font-semibold text-white/50">
              💎 Under the radar near you
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {[...RESTAURANTS]
                .sort((a, b) => gemScore(b) - gemScore(a))
                .slice(0, 6)
                .map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      setQ(r.name);
                      setSubmitted(r.name);
                    }}
                    className="overflow-hidden rounded-2xl text-left ring-1 ring-white/10"
                    style={{
                      background: `linear-gradient(150deg, ${r.reels[0].gradient[0]}, ${r.reels[0].gradient[1]})`,
                    }}
                  >
                    <div className="flex h-24 items-center justify-center text-4xl">
                      {r.reels[0].emoji}
                    </div>
                    <div className="bg-black/40 p-2.5 backdrop-blur-sm">
                      <div className="truncate text-sm font-bold">{r.name}</div>
                      <div className="text-[11px] text-white/60">
                        {r.cuisines[0]} · ⭐ {r.rating.toFixed(1)}
                      </div>
                    </div>
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
