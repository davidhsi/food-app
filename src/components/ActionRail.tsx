"use client";

import { Reel, Restaurant } from "@/lib/types";
import { useStore } from "@/lib/store";
import {
  BookmarkIcon,
  CommentIcon,
  HeartIcon,
  PlusIcon,
  ShareIcon,
} from "./icons";

function compact(n: number) {
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k";
  return String(n);
}

function RailButton({
  children,
  label,
  active,
  onClick,
  color = "text-white",
}: {
  children: React.ReactNode;
  label?: string;
  active?: boolean;
  onClick?: () => void;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 text-white/95 active:scale-90 transition-transform"
    >
      <span
        className={`grid h-12 w-12 place-items-center rounded-full bg-black/30 backdrop-blur-md ring-1 ring-white/10 ${
          active ? color : ""
        }`}
      >
        {children}
      </span>
      {label && (
        <span className="text-[11px] font-semibold text-shadow">{label}</span>
      )}
    </button>
  );
}

export default function ActionRail({
  restaurant,
  reel,
  onRank,
}: {
  restaurant: Restaurant;
  reel: Reel;
  onRank: () => void;
}) {
  const { liked, saved, toggleLike, toggleSave } = useStore();
  const isLiked = liked.includes(restaurant.id);
  const isSaved = saved.includes(restaurant.id);

  return (
    <div className="flex flex-col items-center gap-4">
      <RailButton
        label={compact(reel.likes + (isLiked ? 1 : 0))}
        active={isLiked}
        color="text-brand"
        onClick={() => toggleLike(restaurant.id)}
      >
        <HeartIcon filled={isLiked} width={26} height={26} />
      </RailButton>

      <RailButton
        label={isSaved ? "Saved" : "Save"}
        active={isSaved}
        color="text-brand-glow"
        onClick={() => toggleSave(restaurant.id)}
      >
        <BookmarkIcon filled={isSaved} width={24} height={24} />
      </RailButton>

      <RailButton label="Rank" onClick={onRank}>
        <PlusIcon width={26} height={26} />
      </RailButton>

      <RailButton label="Reviews">
        <CommentIcon width={24} height={24} />
      </RailButton>

      <RailButton
        label="Share"
        onClick={() => {
          const url =
            typeof window !== "undefined"
              ? `${window.location.origin}/restaurant/${restaurant.id}`
              : "";
          if (navigator.share)
            navigator.share({ title: restaurant.name, url }).catch(() => {});
          else if (navigator.clipboard) navigator.clipboard.writeText(url);
        }}
      >
        <ShareIcon width={24} height={24} />
      </RailButton>
    </div>
  );
}
