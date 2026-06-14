"use client";

import { useMemo } from "react";
import AppShell from "@/components/AppShell";
import Feed from "@/components/Feed";
import HelpMeDecide from "@/components/HelpMeDecide";
import { useStore } from "@/lib/store";
import { recommend } from "@/lib/recommend";

export default function FeedPage() {
  const profile = useStore((s) => s.profile);
  const liked = useStore((s) => s.liked);
  const saved = useStore((s) => s.saved);
  const ranked = useStore((s) => s.ranked);
  const seen = useStore((s) => s.seen);

  const restaurants = useMemo(() => {
    const scored = recommend({ profile, liked, saved, ranked, seen });
    return scored.map((s) => s.restaurant);
  }, [profile, liked, saved, ranked, seen]);

  return (
    <AppShell>
      <div className="h-full overflow-y-auto pb-24">
        <header className="px-5 pb-3 pt-9">
          <div className="font-display text-2xl font-semibold tracking-tight text-ink">
            Truffle<span className="text-olive">.</span>
          </div>
          <p className="mt-0.5 text-[13px] text-ink-soft">
            Before everyone finds out
          </p>
        </header>
        <Feed restaurants={restaurants} />
        <HelpMeDecide />
      </div>
    </AppShell>
  );
}
