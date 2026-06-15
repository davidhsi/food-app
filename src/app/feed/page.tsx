"use client";

import { useMemo } from "react";
import AppShell from "@/components/AppShell";
import Feed from "@/components/Feed";
import HelpMeDecide from "@/components/HelpMeDecide";
import NeighborhoodChips from "@/components/NeighborhoodChips";
import { useStore } from "@/lib/store";
import { recommend } from "@/lib/recommend";

export default function FeedPage() {
  const profile = useStore((s) => s.profile);
  const liked = useStore((s) => s.liked);
  const saved = useStore((s) => s.saved);
  const ranked = useStore((s) => s.ranked);
  const seen = useStore((s) => s.seen);
  const neighborhood = useStore((s) => s.neighborhood);

  const restaurants = useMemo(() => {
    const scored = recommend({
      profile,
      liked,
      saved,
      ranked,
      seen,
      neighborhood,
    });
    return scored.map((s) => s.restaurant);
  }, [profile, liked, saved, ranked, seen, neighborhood]);

  return (
    <AppShell>
      <div className="h-full overflow-y-auto pb-24">
        <header className="px-5 pb-3 pt-9">
          <div className="font-display text-2xl font-semibold tracking-tight text-ink">
            Truffle<span className="text-olive">.</span>
          </div>
          <p className="mt-0.5 text-[13px] text-ink-soft">
            {neighborhood
              ? `Gems in ${neighborhood}`
              : "Before everyone finds out"}
          </p>
        </header>
        <NeighborhoodChips />
        <Feed restaurants={restaurants} />
        <HelpMeDecide />
      </div>
    </AppShell>
  );
}
