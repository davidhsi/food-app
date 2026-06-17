"use client";

import { useEffect, useMemo, useState } from "react";
import { Restaurant } from "@/lib/types";
import { useStore } from "@/lib/store";
import { buildLocalOrderGuide, OrderGuide as Guide } from "@/lib/order";
import { UtensilsIcon } from "./icons";

/**
 * "What to order" — a taste-aware ordering guide on the detail page.
 *
 * Renders the deterministic local guide instantly (the detail page already holds
 * the full record, so no network or skeleton is needed), then quietly upgrades
 * it via `/api/order` when an ANTHROPIC_API_KEY is configured. Errors are
 * swallowed — the local guide stays. Honesty: picks only ever come from the
 * restaurant's real signature dishes, and we always pair them with a
 * confirm-with-staff note since our data isn't an authoritative menu.
 */
export default function OrderGuide({ restaurant: r }: { restaurant: Restaurant }) {
  const profile = useStore((s) => s.profile);
  const local = useMemo(() => buildLocalOrderGuide(r, profile), [r, profile]);
  const [guide, setGuide] = useState<Guide>(local);

  // Re-seed when the restaurant or taste changes, then try to upgrade.
  useEffect(() => {
    setGuide(local);
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/order", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ restaurantId: r.id, profile }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || data.engine !== "claude" || !data.picks?.length) return;
        setGuide({ intro: data.intro ?? local.intro, picks: data.picks });
      } catch {
        /* keep the local guide */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [r.id, profile, local]);

  // Nothing useful to show (no dishes and no intro) — render nothing.
  if (!guide.picks.length && !guide.intro) return null;

  return (
    <div className="px-5 pt-5">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink-faint">
        <UtensilsIcon width={15} height={15} /> What to order
      </h2>
      {guide.intro && (
        <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{guide.intro}</p>
      )}
      {guide.picks.length > 0 && (
        <ul className="mt-3 space-y-2">
          {guide.picks.map((p) => (
            <li
              key={p.dish}
              className="rounded-2xl border border-line bg-paper-raised px-3.5 py-2.5"
            >
              <div className="text-sm font-semibold text-ink">{p.dish}</div>
              <div className="mt-0.5 text-xs text-ink-soft">{p.why}</div>
              {p.cautions && p.cautions.length > 0 && (
                <div className="mt-1.5 text-[11px] font-semibold text-olive-deep">
                  ◷ May contain {p.cautions.join(", ")} — ask the kitchen.
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
        Menus change — confirm any allergies or dietary needs with the restaurant.
      </p>
    </div>
  );
}
