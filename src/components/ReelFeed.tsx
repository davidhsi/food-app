"use client";

import { useState } from "react";
import { Restaurant } from "@/lib/types";
import { useStore } from "@/lib/store";
import ReelCard, { FeedItem } from "./ReelCard";
import RankModal from "./RankModal";

export default function ReelFeed({
  items,
  emptyLabel = "No reels yet.",
}: {
  items: FeedItem[];
  emptyLabel?: string;
}) {
  const markSeen = useStore((s) => s.markSeen);
  const [ranking, setRanking] = useState<Restaurant | null>(null);

  if (items.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-white/50">
        {emptyLabel}
      </div>
    );
  }

  return (
    <>
      <div className="no-scrollbar snap-y-mandatory h-full w-full overflow-y-scroll">
        {items.map((item) => (
          <div key={item.reel.id} className="h-full w-full">
            <ReelCard
              item={item}
              onRank={(r) => setRanking(r)}
              onVisible={(r) => markSeen(r.id)}
            />
          </div>
        ))}
      </div>
      {ranking && (
        <RankModal restaurant={ranking} onClose={() => setRanking(null)} />
      )}
    </>
  );
}
