"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { recommend } from "@/lib/recommend";
import { track } from "@/lib/analytics";
import { SparkleIcon, ArrowRight } from "./icons";

export default function HelpMeDecide() {
  const router = useRouter();
  const profile = useStore((s) => s.profile);
  const liked = useStore((s) => s.liked);
  const saved = useStore((s) => s.saved);
  const ranked = useStore((s) => s.ranked);
  const seen = useStore((s) => s.seen);
  const [open, setOpen] = useState(false);
  const [askCount, setAskCount] = useState(0);

  const pick = useMemo(() => {
    const scored = recommend({ profile, liked, saved, ranked, seen });
    const top = scored.slice(0, 5);
    return top.length ? top[askCount % top.length] : null;
  }, [profile, liked, saved, ranked, seen, askCount]);

  if (!pick) return null;

  return (
    <div className="px-5 pb-8 pt-2">
      {!open ? (
        <button
          type="button"
          onClick={() => {
            track("help_me_decide", pick ? { id: pick.restaurant.id } : undefined);
            setOpen(true);
          }}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-olive py-3 text-sm font-semibold text-paper active:scale-[0.98]"
        >
          <SparkleIcon width={17} height={17} /> Can&apos;t decide? Truffle picks tonight
        </button>
      ) : (
        <div className="rounded-2xl border border-line bg-paper-raised p-4 animate-floatUp">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-olive">
            Tonight, go to
          </div>
          <h3 className="mt-1 font-display text-2xl font-semibold text-ink">
            {pick.restaurant.name}
          </h3>
          <div className="mt-1 text-[13px] text-ink-soft">
            {pick.restaurant.cuisines.join(" · ")} · {pick.restaurant.neighborhood}
          </div>
          {pick.reasons[0] && (
            <p className="mt-2 text-sm text-ink">
              Why: {pick.reasons[0].label.replace(/\s*🌶️/g, "").replace(/\s*💎/g, "").trim()}.
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => router.push(`/restaurant/${pick.restaurant.id}`)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-olive py-2.5 text-sm font-semibold text-paper active:scale-95"
            >
              See it <ArrowRight width={16} height={16} />
            </button>
            <button
              type="button"
              onClick={() => setAskCount((n) => n + 1)}
              className="rounded-full bg-paper px-4 py-2.5 text-sm font-medium text-ink-soft ring-1 ring-line active:scale-95"
            >
              Pick again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
