"use client";

import { useMemo } from "react";
import AppShell from "@/components/AppShell";
import ReelFeed from "@/components/ReelFeed";
import { useStore } from "@/lib/store";
import { recommend } from "@/lib/recommend";
import { toFeedItems } from "@/lib/feed";

export default function FeedPage() {
  const profile = useStore((s) => s.profile);
  const liked = useStore((s) => s.liked);
  const saved = useStore((s) => s.saved);
  const ranked = useStore((s) => s.ranked);
  const seen = useStore((s) => s.seen);

  const items = useMemo(() => {
    const scored = recommend({ profile, liked, saved, ranked, seen });
    return toFeedItems(scored);
  }, [profile, liked, saved, ranked, seen]);

  return (
    <AppShell>
      <div className="relative h-full">
        <ReelFeed items={items} />
        <div className="pointer-events-none absolute inset-x-0 top-4 z-20 text-center text-lg font-black tracking-tight text-white text-shadow">
          For You
        </div>
      </div>
    </AppShell>
  );
}
