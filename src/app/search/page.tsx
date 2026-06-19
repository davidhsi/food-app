"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import SpotCard from "@/components/SpotCard";
import Link from "next/link";
import { SearchIcon, XIcon, SparkleIcon, ArrowRight } from "@/components/icons";
import { RESTAURANTS, ALL_CUISINES } from "@/lib/data";
import { resolveNearbyNeighborhood } from "@/lib/neighborhoods";
import { parseQuery, recommend } from "@/lib/recommend";
import { useStore } from "@/lib/store";
import { track } from "@/lib/analytics";
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
  // Resolved once via geolocation when a query asks for "near me"; reused after.
  const [geoNbhd, setGeoNbhd] = useState<string | null>(null);

  // When a submitted query has "near me" intent, resolve the user's nearest
  // neighborhood so the result memo can steer toward it. Fail-silent: a denial
  // leaves geoNbhd null and search just stays city-wide.
  useEffect(() => {
    const active = submitted.trim();
    if (!active || geoNbhd) return;
    if (parseQuery(active).nearMe) {
      resolveNearbyNeighborhood().then((n) => {
        if (n) setGeoNbhd(n);
      });
    }
  }, [submitted, geoNbhd]);

  const results = useMemo(() => {
    const active = submitted.trim();
    if (!active && !cuisine) return null;

    // Combine literal text match with NL parsing, then rank by taste fit.
    let pool = RESTAURANTS;
    if (cuisine) pool = pool.filter((r) => r.cuisines.includes(cuisine as any));
    const parsed = active ? parseQuery(active) : { keywords: [] };
    let fallback = false;
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
      if (merged.length) {
        pool = merged;
      } else if (!undergroundIntent) {
        // No literal match (e.g. a full question like "what to eat around me").
        // Don't dead-end — keep the full pool, rank it by taste, and flag it so
        // the UI is honest that these are recommendations, not exact matches.
        fallback = true;
      }
    }

    // If the query named an area ("chinese in Lakeview"), steer hard toward it
    // so the named neighborhood's spots rank first instead of the city-wide
    // best match — same behavior as the concierge. "near me" resolves to the
    // user's geolocated neighborhood instead.
    const named = ("neighborhood" in parsed && parsed.neighborhood) || null;
    const nearby = !!(parsed.nearMe && geoNbhd);
    const neighborhood = nearby ? geoNbhd : named;

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
        neighborhood,
        neighborhoodStrict: !!neighborhood,
      },
      pool,
    );
    return { list: scored, fallback, nearby };
  }, [
    submitted,
    cuisine,
    geoNbhd,
    store.profile,
    store.liked,
    store.saved,
    store.ranked,
  ]);

  const runQuery = (t: string) => {
    setQ(t);
    setSubmitted(t);
    track("search_submit", { query: t.slice(0, 80) });
  };

  // Hand-off to the AI concierge for open-ended questions search can't answer
  // literally. Pre-fills the query so the concierge answers it on arrival.
  const conciergeHandoff = (query: string) => (
    <Link
      href={`/assistant?q=${encodeURIComponent(query)}`}
      onClick={() => track("search_to_concierge", { query: query.slice(0, 80) })}
      className="mt-3 flex items-center gap-2 rounded-2xl bg-olive px-4 py-3 text-left text-sm font-semibold text-paper active:scale-[0.98]"
    >
      <SparkleIcon width={17} height={17} className="shrink-0" />
      <span className="min-w-0 flex-1 truncate">
        Ask the concierge about &ldquo;{query}&rdquo;
      </span>
      <ArrowRight width={16} height={16} className="shrink-0" />
    </Link>
  );

  // Discovery blocks shown both before a search and as a recovery path when a
  // search returns nothing — so the dead end always offers somewhere to go.
  const discovery = (
    <>
      <h2 className="font-display text-sm font-semibold text-ink-faint">
        Trending searches
      </h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {TRENDING.map((t) => (
          <button
            key={t}
            onClick={() => runQuery(t)}
            className="rounded-full bg-paper-raised px-4 py-2 text-sm text-ink-soft ring-1 ring-line active:scale-95"
          >
            {t}
          </button>
        ))}
      </div>

      <h2 className="font-display mt-8 text-sm font-semibold text-ink-faint">
        <span className="text-olive">◆</span> Under the radar near you
      </h2>
      <div className="mt-3">
        {[...RESTAURANTS]
          .sort((a, b) => gemScore(b) - gemScore(a))
          .slice(0, 6)
          .map((r) => (
            <SpotCard key={r.id} restaurant={r} />
          ))}
      </div>
    </>
  );

  return (
    <AppShell>
      <div className="relative h-full">
        {/* Search header */}
        <div className="absolute inset-x-0 top-0 z-30 bg-gradient-to-b from-paper to-paper/0 p-4 pb-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSubmitted(q);
              if (q.trim()) track("search_submit", { query: q.trim().slice(0, 80) });
            }}
            role="search"
            className="flex items-center gap-2 rounded-full bg-paper-raised px-4 py-2.5 ring-1 ring-line backdrop-blur-md"
          >
            <SearchIcon width={18} height={18} className="text-ink-faint" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search dishes, vibes, places…"
              aria-label="Search dishes, vibes, or places"
              className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint focus:ring-0 [&::-webkit-search-cancel-button]:hidden"
            />
            {q && (
              <button
                type="button"
                onClick={() => {
                  setQ("");
                  setSubmitted("");
                }}
                aria-label="Clear search"
                className="-mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-faint active:scale-90"
              >
                <XIcon width={16} height={16} />
              </button>
            )}
          </form>

          <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto [mask-image:linear-gradient(to_right,black_92%,transparent)]">
            <button
              onClick={() => setCuisine(null)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${
                !cuisine ? "bg-olive text-paper" : "bg-paper-raised text-ink-soft ring-1 ring-line"
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
                    ? "bg-olive text-paper"
                    : "bg-paper-raised text-ink-soft ring-1 ring-line"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        {results ? (
          <div className="h-full overflow-y-auto px-4 pb-24 pt-32">
            {results.list.length === 0 ? (
              <div className="px-1">
                <p className="pt-2 text-center text-sm text-ink-soft">
                  No matches for &quot;{submitted}&quot;. Here&apos;s where to look
                  instead.
                </p>
                {submitted.trim() && conciergeHandoff(submitted.trim())}
                <div className="mt-6">{discovery}</div>
              </div>
            ) : (
              <>
                {(results.fallback || results.nearby) && (
                  <div className="mb-5">
                    <p className="text-sm text-ink-soft">
                      {results.nearby
                        ? "Gems near you — ranked for your taste."
                        : "No exact matches — here's what we'd recommend."}
                    </p>
                    {submitted.trim() && conciergeHandoff(submitted.trim())}
                  </div>
                )}
                {results.list.map((s) => (
                  <SpotCard key={s.restaurant.id} restaurant={s.restaurant} />
                ))}
              </>
            )}
          </div>
        ) : (
          <div className="h-full overflow-y-auto px-5 pb-24 pt-32">{discovery}</div>
        )}
      </div>
    </AppShell>
  );
}
