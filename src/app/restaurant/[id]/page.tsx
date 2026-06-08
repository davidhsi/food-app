"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getRestaurant } from "@/lib/data";
import { useStore } from "@/lib/store";
import RankModal from "@/components/RankModal";
import {
  BookmarkIcon,
  ChevronLeft,
  HeartIcon,
  PinIcon,
  PlusIcon,
  StarIcon,
} from "@/components/icons";

export default function RestaurantPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const r = getRestaurant(params.id);
  const { liked, saved, ranked, toggleLike, toggleSave } = useStore();
  const [ranking, setRanking] = useState(false);
  const [activeReel, setActiveReel] = useState(0);

  if (!r) {
    return (
      <div className="phone-shell flex items-center justify-center text-white/60">
        Restaurant not found.
      </div>
    );
  }

  const isLiked = liked.includes(r.id);
  const isSaved = saved.includes(r.id);
  const myRank = ranked.find((e) => e.restaurantId === r.id);
  const reel = r.reels[activeReel];

  return (
    <div className="phone-shell overflow-y-auto pb-8">
      {/* Hero */}
      <div className="relative h-[46%] min-h-[320px]">
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(160deg, ${reel.gradient[0]}, ${reel.gradient[1]})`,
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center text-[120px] opacity-30">
          {reel.emoji}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={reel.poster}
          alt={r.name}
          onError={(e) => (e.currentTarget.style.display = "none")}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-ink via-ink/40 to-transparent" />

        <button
          onClick={() => router.back()}
          className="absolute left-3 top-4 grid h-10 w-10 place-items-center rounded-full bg-black/40 backdrop-blur-md"
        >
          <ChevronLeft width={22} height={22} />
        </button>

        {/* Reel selector dots */}
        {r.reels.length > 1 && (
          <div className="absolute right-3 top-5 flex flex-col gap-1.5">
            {r.reels.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveReel(i)}
                className={`h-2 w-2 rounded-full ${
                  i === activeReel ? "bg-white" : "bg-white/40"
                }`}
              />
            ))}
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 p-5">
          <h1 className="text-shadow text-3xl font-black leading-tight">
            {r.name}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-white/85">
            <span className="inline-flex items-center gap-1 font-bold text-brand-glow">
              <StarIcon filled width={15} height={15} /> {r.rating.toFixed(1)}
            </span>
            <span className="text-white/40">·</span>
            <span>{r.cuisines.join(" · ")}</span>
            <span className="text-white/40">·</span>
            <span>{"$".repeat(r.price)}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-white/65">
            <PinIcon width={13} height={13} />
            {r.neighborhood}, {r.city} · {r.distanceKm} km away
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 px-5 py-4">
        <button
          onClick={() => setRanking(true)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-brand py-3 text-sm font-bold shadow-lg shadow-brand/30 active:scale-95"
        >
          <PlusIcon width={18} height={18} />
          {myRank ? `Ranked ${myRank.score.toFixed(1)}` : "Rank it"}
        </button>
        <button
          onClick={() => toggleSave(r.id)}
          className={`grid h-12 w-12 place-items-center rounded-full ring-1 ring-white/15 active:scale-95 ${
            isSaved ? "bg-brand-glow/20 text-brand-glow" : "bg-white/5"
          }`}
        >
          <BookmarkIcon filled={isSaved} width={20} height={20} />
        </button>
        <button
          onClick={() => toggleLike(r.id)}
          className={`grid h-12 w-12 place-items-center rounded-full ring-1 ring-white/15 active:scale-95 ${
            isLiked ? "bg-brand/20 text-brand" : "bg-white/5"
          }`}
        >
          <HeartIcon filled={isLiked} width={20} height={20} />
        </button>
      </div>

      {/* Caption */}
      <div className="px-5">
        <p className="text-sm text-white/85">{reel.caption}</p>
        <p className="mt-1 text-xs text-white/45">
          {reel.author} · {reel.likes.toLocaleString()} likes
        </p>
      </div>

      {/* About */}
      <div className="px-5 pt-5">
        <h2 className="text-sm font-bold text-white/50">About</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-white/85">{r.blurb}</p>
      </div>

      {/* Signature dishes */}
      <div className="px-5 pt-5">
        <h2 className="text-sm font-bold text-white/50">Signature dishes</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {r.signatureDishes.map((d) => (
            <span
              key={d}
              className="rounded-full bg-white/8 px-3 py-1.5 text-xs font-medium ring-1 ring-white/10"
            >
              {d}
            </span>
          ))}
        </div>
      </div>

      {/* Tags / vibes */}
      <div className="px-5 pt-5">
        <h2 className="text-sm font-bold text-white/50">Known for</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {[...r.tags, ...r.vibes.map((v) => v.replace("-", " "))].map((t) => (
            <span
              key={t}
              className="rounded-full bg-white/5 px-3 py-1.5 text-xs text-white/70 ring-1 ring-white/10"
            >
              #{t.replace(/\s+/g, "")}
            </span>
          ))}
        </div>
      </div>

      {ranking && (
        <RankModal restaurant={r} onClose={() => setRanking(false)} />
      )}
    </div>
  );
}
