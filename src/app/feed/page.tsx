"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import Feed from "@/components/Feed";
import HelpMeDecide from "@/components/HelpMeDecide";
import SpotCard from "@/components/SpotCard";
import SearchBar from "@/components/discover/SearchBar";
import Shelf from "@/components/discover/Shelf";
import HeroSpot from "@/components/discover/HeroSpot";
import { SparkleIcon, ArrowRight } from "@/components/icons";
import { RESTAURANTS } from "@/lib/data";
import { resolveNearbyNeighborhood } from "@/lib/neighborhoods";
import { parseQuery, recommend } from "@/lib/recommend";
import { buildShelves } from "@/lib/shelves";
import { useScrollRestoration } from "@/lib/useScrollRestoration";
import { useStore } from "@/lib/store";
import { track } from "@/lib/analytics";
import { Restaurant } from "@/lib/types";

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

/**
 * The Discover home — one editorial surface that replaces the old flat Feed and
 * the standalone Search page. A persistent SearchBar sits on top; with no query
 * or cuisine filter it shows editorial shelves (browse mode), and once either is
 * active it shows ranked results (search mode). Conversational queries hand off
 * to the AI concierge rather than pretending to be a second one.
 */
export default function DiscoverPage() {
  const store = useStore();
  const profile = store.profile;
  const liked = store.liked;
  const saved = store.saved;
  const ranked = store.ranked;
  const seen = store.seen;
  const neighborhood = store.neighborhood;
  const nearMe = store.neighborhoodNearMe;
  const submitted = store.searchSubmitted;
  const cuisine = store.searchCuisine;
  const geoNbhd = store.searchGeoNbhd;

  const searchActive = submitted.trim() !== "" || cuisine !== null;

  // One scored pass over the full dataset, shared by both modes. Browse slices
  // it into shelves; search filters a pool and re-scores (it may steer harder).
  const scored = useMemo(
    () => recommend({ profile, liked, saved, ranked, seen, neighborhood }),
    [profile, liked, saved, ranked, seen, neighborhood],
  );

  const { hero, shelves, tail } = useMemo(
    () =>
      buildShelves({
        scored,
        cuisines: profile.cuisines,
        saved,
        liked,
        ranked,
        neighborhood,
        nameById: (id) => RESTAURANTS.find((r) => r.id === id)?.name,
      }),
    [scored, profile.cuisines, saved, liked, ranked, neighborhood],
  );

  // "near me" intent → resolve the user's nearest neighborhood for steering.
  // Fail-silent, mirroring the old Search behavior.
  useEffect(() => {
    const active = submitted.trim();
    if (!active || geoNbhd) return;
    if (parseQuery(active).nearMe) {
      resolveNearbyNeighborhood().then((n) => {
        if (n) store.setSearch({ searchGeoNbhd: n });
      });
    }
  }, [submitted, geoNbhd]); // eslint-disable-line react-hooks/exhaustive-deps

  const results = useMemo(() => {
    if (!searchActive) return null;
    const active = submitted.trim();

    let pool = RESTAURANTS;
    if (cuisine) pool = pool.filter((r) => r.cuisines.includes(cuisine as any));
    const parsed = active ? parseQuery(active) : { keywords: [] as string[] };
    let fallback = false;
    if (active) {
      const direct = pool.filter((r) => matches(r, active));
      const byParse = pool.filter((r) => {
        const cu =
          "cuisines" in parsed
            ? parsed.cuisines?.some((c) => r.cuisines.includes(c)) ?? false
            : false;
        const vi =
          "vibes" in parsed
            ? parsed.vibes?.some((v) => r.vibes.includes(v)) ?? false
            : false;
        return cu || vi;
      });
      const merged = Array.from(new Set([...direct, ...byParse]));
      const undergroundIntent =
        ("undergroundBias" in parsed ? parsed.undergroundBias ?? 0 : 0) >= 0.5;
      if (merged.length) {
        pool = merged;
      } else if (!undergroundIntent) {
        fallback = true;
      }
    }

    const named =
      ("neighborhood" in parsed && parsed.neighborhood) || null;
    const nearby = !!("nearMe" in parsed && parsed.nearMe && geoNbhd);
    const steer = nearby ? geoNbhd : named;

    const list = recommend(
      {
        profile: {
          ...profile,
          undergroundBias:
            ("undergroundBias" in parsed
              ? parsed.undergroundBias
              : undefined) ?? profile.undergroundBias,
        },
        liked,
        saved,
        ranked,
        neighborhood: steer,
        neighborhoodStrict: !!steer,
      },
      pool,
    );
    return { list, fallback, nearby };
  }, [searchActive, submitted, cuisine, geoNbhd, profile, liked, saved, ranked]);

  // Browse and search are distinct lists, so key scroll restoration separately.
  const scrollKey = searchActive ? `search:${submitted}:${cuisine ?? ""}` : "discover";
  const scrollRef = useScrollRestoration<HTMLDivElement>(scrollKey);

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

  const trendingChips = (
    <div className="mt-3 flex flex-wrap gap-2">
      {TRENDING.map((t) => (
        <button
          key={t}
          onClick={() => {
            store.setSearch({ searchQuery: t, searchSubmitted: t });
            track("search_submit", { query: t.slice(0, 80) });
          }}
          className="rounded-full bg-paper-raised px-4 py-2 text-sm text-ink-soft ring-1 ring-line active:scale-95"
        >
          {t}
        </button>
      ))}
    </div>
  );

  return (
    <AppShell>
      <div ref={scrollRef} className="h-full overflow-y-auto pb-24">
        {!searchActive && (
          <header className="px-5 pb-2 pt-4">
            <div className="font-display text-2xl font-semibold tracking-tight text-ink">
              Truffle<span className="text-olive">.</span>
            </div>
            <p className="mt-0.5 text-[13px] text-ink-soft">
              {nearMe
                ? "Gems near you"
                : neighborhood
                  ? `Gems in ${neighborhood}`
                  : "Before everyone finds out"}
            </p>
          </header>
        )}
        <SearchBar />

        {searchActive && results ? (
          /* ---- Search / results mode ---- */
          <div className="px-4 pt-2">
            {results.list.length === 0 ? (
              <div className="px-1">
                <p className="pt-2 text-center text-sm text-ink-soft">
                  No matches for &quot;{submitted}&quot;. Here&apos;s where to look
                  instead.
                </p>
                {submitted.trim() && conciergeHandoff(submitted.trim())}
                <h2 className="mt-8 font-display text-sm font-semibold text-ink-faint">
                  Trending searches
                </h2>
                {trendingChips}
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
          /* ---- Browse / editorial mode ---- */
          <>
            {hero && <HeroSpot scored={hero} />}
            <HelpMeDecide excludeId={hero?.restaurant.id} />
            {shelves.map((s) => (
              <Shelf
                key={s.key}
                scrollKey={s.key}
                title={s.title}
                restaurants={s.restaurants}
              />
            ))}
            {tail.length > 0 && (
              <>
                <h2 className="px-5 pb-1 font-display text-lg font-semibold text-ink">
                  More to discover
                </h2>
                <Feed restaurants={tail} />
              </>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
