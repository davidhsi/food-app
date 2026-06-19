"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { gemScore, Restaurant } from "@/lib/types";
import { useStore } from "@/lib/store";
import { scoreRestaurant } from "@/lib/recommend";
import { track } from "@/lib/analytics";
import RankModal from "@/components/RankModal";
import ShareSpot from "@/components/ShareSpot";
import UserDistance from "@/components/UserDistance";
import OrderGuide from "@/components/OrderGuide";
import {
  BookmarkIcon,
  ChevronLeft,
  HeartIcon,
  PinIcon,
  PlusIcon,
  StarIcon,
} from "@/components/icons";

/**
 * Detail view. Receives the FULL record (incl. detail-only `insiderTip`/`blurb`)
 * from the server component wrapper, so the client never bundles those fields
 * for every restaurant — they arrive per-record, on demand.
 */
export default function RestaurantDetail({
  restaurant: r,
}: {
  restaurant: Restaurant;
}) {
  const router = useRouter();
  const profile = useStore((s) => s.profile);
  const liked = useStore((s) => s.liked);
  const saved = useStore((s) => s.saved);
  const ranked = useStore((s) => s.ranked);
  const seen = useStore((s) => s.seen);
  const toggleLike = useStore((s) => s.toggleLike);
  const toggleSave = useStore((s) => s.toggleSave);
  const [ranking, setRanking] = useState(false);

  const scored = useMemo(
    () => scoreRestaurant(r, { profile, liked, saved, ranked, seen }),
    [r, profile, liked, saved, ranked, seen],
  );

  const isLiked = liked.includes(r.id);
  const isSaved = saved.includes(r.id);
  const myRank = ranked.find((e) => e.restaurantId === r.id);
  const poster = r.reels[0]?.poster;
  const found = Math.round(r.buzz * 100);
  const isGem = gemScore(r) >= 0.45;

  useEffect(() => {
    track("restaurant_view", { id: r.id, neighborhood: r.neighborhood });
  }, [r.id, r.neighborhood]);

  const onSave = () => {
    track("save_toggle", { id: r.id, saved: !isSaved, source: "detail" });
    toggleSave(r.id);
  };
  const onLike = () => {
    track("like_toggle", { id: r.id, liked: !isLiked });
    toggleLike(r.id);
  };

  return (
    <div className="phone-shell bg-paper">
      {/* `.phone-shell` is `overflow:hidden`; scroll on an inner inset child
          (same pattern as AppShell) so the detail content can scroll. */}
      <div className="absolute inset-0 overflow-y-auto pb-10">
      {/* Hero */}
      <div className="relative h-[44%] min-h-[300px] bg-line">
        {poster && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={poster}
            alt={r.name}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink/85 to-transparent" />
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className="absolute left-3 top-4 grid h-10 w-10 place-items-center rounded-full bg-paper-raised/90 text-ink backdrop-blur-sm"
        >
          <ChevronLeft width={22} height={22} />
        </button>
        <div className="absolute inset-x-0 bottom-0 p-5">
          <h1 className="font-display text-3xl font-semibold leading-tight text-paper">
            {r.name}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-paper/90">
            <span className="inline-flex items-center gap-1 font-semibold text-gem">
              <StarIcon filled width={15} height={15} /> {r.rating.toFixed(1)}
            </span>
            <span className="text-paper/50">·</span>
            <span>{r.cuisines.join(" · ")}</span>
            <span className="text-paper/50">·</span>
            <span>{"$".repeat(r.price)}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-paper/70">
            <PinIcon width={13} height={13} />
            {r.neighborhood}, {r.city}
            <UserDistance lat={r.lat} lng={r.lng} />
          </div>
        </div>
      </div>

      {/* Earliness cue (derived from buzz; not a live count) */}
      {isGem && (
        <div className="mx-5 mt-4 rounded-2xl border border-line bg-paper-raised px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-olive">
            ◷ You&apos;d be early
          </div>
          <p className="mt-0.5 text-sm text-ink-soft">
            Still under the radar — only about {found}% of people have found it.
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 px-5 py-4">
        <button
          type="button"
          onClick={() => setRanking(true)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-olive py-3 text-sm font-semibold text-paper active:scale-95"
        >
          <PlusIcon width={18} height={18} />
          {myRank ? `Ranked ${myRank.score.toFixed(1)}` : "Rank it"}
        </button>
        <button
          type="button"
          onClick={onSave}
          aria-label={isSaved ? "Remove from want to try" : "Save to want to try"}
          aria-pressed={isSaved}
          className={`grid h-12 w-12 place-items-center rounded-full ring-1 ring-line active:scale-95 ${
            isSaved ? "bg-olive/15 text-olive" : "bg-paper-raised text-ink"
          }`}
        >
          <BookmarkIcon filled={isSaved} width={20} height={20} />
        </button>
        <button
          type="button"
          onClick={onLike}
          aria-label={isLiked ? "Unlike" : "Like"}
          aria-pressed={isLiked}
          className={`grid h-12 w-12 place-items-center rounded-full ring-1 ring-line active:scale-95 ${
            isLiked ? "bg-olive/15 text-olive" : "bg-paper-raised text-ink"
          }`}
        >
          <HeartIcon filled={isLiked} width={20} height={20} />
        </button>
        <ShareSpot restaurant={r} />
      </div>

      {/* Why you */}
      {scored && scored.reasons.length > 0 && (
        <div className="px-5">
          <h2 className="text-sm font-semibold text-ink-faint">Why you&apos;ll like it</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {scored.reasons.map((why) => (
              <span
                key={why.label}
                className="rounded-full bg-paper-raised px-3 py-1.5 text-xs font-medium text-ink-soft ring-1 ring-line"
              >
                {why.label.replace(/\s*🌶️/g, "").replace(/\s*💎/g, "").trim()}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* What to order (taste-aware; instant local guide, Claude-upgraded) */}
      <OrderGuide restaurant={r} />

      {/* Insider tip */}
      {r.insiderTip && (
        <div className="mx-5 mt-5 rounded-2xl border border-line bg-paper-raised p-3.5">
          <div className="text-xs font-semibold uppercase tracking-wide text-olive">
            Order like a regular
          </div>
          <p className="mt-1 text-sm text-ink">{r.insiderTip}</p>
        </div>
      )}

      {/* About */}
      {r.blurb && (
        <div className="px-5 pt-5">
          <h2 className="text-sm font-semibold text-ink-faint">About</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-ink">{r.blurb}</p>
        </div>
      )}

      {/* Known for */}
      <div className="px-5 pt-5">
        <h2 className="text-sm font-semibold text-ink-faint">Known for</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {[...r.tags, ...r.vibes.map((v) => v.replace("-", " "))].map((t) => (
            <span
              key={t}
              className="rounded-full bg-paper-raised px-3 py-1.5 text-xs text-ink-soft ring-1 ring-line"
            >
              #{t.replace(/\s+/g, "")}
            </span>
          ))}
        </div>
      </div>

      </div>

      {ranking && <RankModal restaurant={r} onClose={() => setRanking(false)} />}
    </div>
  );
}
