"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Reel, RecommendationReason, Restaurant } from "@/lib/types";
import ActionRail from "./ActionRail";
import { PinIcon, StarIcon } from "./icons";

export interface FeedItem {
  restaurant: Restaurant;
  reel: Reel;
  matchScore?: number;
  reasons?: RecommendationReason[];
}

const priceStr = (p: number) => "$".repeat(p);

export default function ReelCard({
  item,
  onRank,
  onVisible,
}: {
  item: FeedItem;
  onRank: (r: Restaurant) => void;
  onVisible?: (r: Restaurant) => void;
}) {
  const { restaurant: r, reel, matchScore, reasons } = item;
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [imgOk, setImgOk] = useState(true);

  useEffect(() => {
    if (!onVisible || !ref.current) return;
    const el = ref.current;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.intersectionRatio > 0.6) onVisible(r);
      },
      { threshold: [0, 0.6, 1] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [onVisible, r]);

  return (
    <section
      ref={ref}
      className="snap-start relative h-full w-full overflow-hidden bg-black"
    >
      {/* Background visual: gradient + emoji always render; photo layers on top. */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(160deg, ${reel.gradient[0]}, ${reel.gradient[1]})`,
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center opacity-25">
        <span className="text-[160px] leading-none animate-kenburns select-none">
          {reel.emoji}
        </span>
      </div>
      {imgOk && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={reel.poster}
          alt={reel.dish ?? r.name}
          onError={() => setImgOk(false)}
          className="absolute inset-0 h-full w-full object-cover animate-kenburns"
        />
      )}

      {/* Legibility scrims */}
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/60 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

      {/* Match badge */}
      {matchScore !== undefined && (
        <div className="absolute left-4 top-4 z-10 animate-floatUp rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold backdrop-blur-md ring-1 ring-white/25">
          <span className="text-brand-glow">✦</span> {matchScore}% match
        </div>
      )}

      {/* Action rail */}
      <div className="absolute bottom-28 right-3 z-10">
        <ActionRail restaurant={r} reel={reel} onRank={() => onRank(r)} />
      </div>

      {/* Info block */}
      <div className="absolute inset-x-0 bottom-0 z-10 p-4 pb-7 pr-20">
        <button
          onClick={() => router.push(`/restaurant/${r.id}`)}
          className="block text-left"
        >
          <h2 className="text-shadow text-2xl font-extrabold leading-tight">
            {r.name}
          </h2>
          <div className="text-shadow mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/90">
            <span className="inline-flex items-center gap-1 font-semibold text-brand-glow">
              <StarIcon filled width={15} height={15} /> {r.rating.toFixed(1)}
            </span>
            <span className="text-white/50">·</span>
            <span>{r.cuisines.join(" · ")}</span>
            <span className="text-white/50">·</span>
            <span>{priceStr(r.price)}</span>
          </div>
          <div className="text-shadow mt-0.5 flex items-center gap-1 text-xs text-white/70">
            <PinIcon width={13} height={13} />
            {r.neighborhood}, {r.city} · {r.distanceKm} km
          </div>
        </button>

        <p className="text-shadow mt-2 line-clamp-2 text-sm text-white/90">
          {reel.caption}
        </p>
        <p className="mt-1 text-xs font-medium text-white/60">{reel.author}</p>

        {/* Why recommended */}
        {reasons && reasons.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {reasons.map((why) => (
              <span
                key={why.label}
                className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/85 ring-1 ring-white/15 backdrop-blur-sm"
              >
                {why.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
