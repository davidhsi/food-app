"use client";

import Link from "next/link";
import { gemScore, ScoredRestaurant } from "@/lib/types";
import { useStore } from "@/lib/store";
import { track } from "@/lib/analytics";
import { BookmarkIcon, ArrowRight } from "@/components/icons";

const priceStr = (p: number) => "$".repeat(p);
// Reasons carry accent glyphs (🌶️/💎) for the feed badges; the hero reads them
// as a sentence, so strip them — same cleanup HelpMeDecide does.
const clean = (s: string) => s.replace(/\s*🌶️/g, "").replace(/\s*💎/g, "").trim();

/**
 * The editorial centerpiece of the Discover home — the single top-ranked spot,
 * shown large with its #1 "why you" reason. A passive feature (here's a
 * beautiful pick), distinct from HelpMeDecide's active "pick for me" CTA.
 */
export default function HeroSpot({ scored }: { scored: ScoredRestaurant }) {
  const r = scored.restaurant;
  const toggleSave = useStore((s) => s.toggleSave);
  const isSaved = useStore((s) => s.saved.includes(r.id));
  const poster = r.reels[0]?.poster;
  const score = (gemScore(r) * 10).toFixed(1);
  const reason = scored.reasons[0];

  return (
    <section className="mb-7 px-5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-olive">
        Tonight&apos;s gem
      </div>
      <article className="relative mt-2">
        <Link href={`/restaurant/${r.id}`} className="block text-left">
          <div className="relative h-64 overflow-hidden rounded-[22px] bg-line">
            {poster && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={poster}
                alt={r.name}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            )}
            <div
              className="absolute left-3 top-3 rounded-full bg-ink/75 px-2.5 py-1 text-[11px] font-semibold text-paper backdrop-blur-sm"
              aria-label={`Gem score ${score} out of 10`}
            >
              <span className="text-gem" aria-hidden="true">◆</span> {score}
            </div>
          </div>
          <h2 className="mt-3 font-display text-[28px] font-semibold leading-tight text-ink">
            {r.name}
          </h2>
          <div className="mt-1 text-[13px] text-ink-soft">
            <span
              className="font-semibold text-olive"
              aria-label={`Rated ${r.rating.toFixed(1)} out of 10`}
            >
              <span aria-hidden="true">★</span> {r.rating.toFixed(1)}
            </span>{" "}
            · {r.cuisines.join(" · ")} · {priceStr(r.price)} · {r.neighborhood}
          </div>
          {reason && (
            <p className="mt-2 text-sm text-ink">Why you: {clean(reason.label)}.</p>
          )}
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-olive px-4 py-2 text-sm font-semibold text-paper">
            See it <ArrowRight width={16} height={16} />
          </span>
        </Link>
        <button
          type="button"
          onClick={() => {
            track("save_toggle", { id: r.id, saved: !isSaved, source: "card" });
            toggleSave(r.id);
          }}
          aria-label={isSaved ? "Remove from want to try" : "Save to want to try"}
          aria-pressed={isSaved}
          className="absolute right-2.5 top-2.5 grid h-11 w-11 place-items-center rounded-full bg-paper-raised/90 text-ink backdrop-blur-sm active:scale-90 transition-transform"
        >
          <BookmarkIcon filled={isSaved} width={16} height={16} />
        </button>
      </article>
    </section>
  );
}
