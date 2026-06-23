"use client";

import { useMemo, useState } from "react";
import { Restaurant } from "@/lib/types";
import { useStore } from "@/lib/store";
import { buildLocalOrderGuide } from "@/lib/order";
import { UtensilsIcon, ChevronDownIcon } from "./icons";

/**
 * "What to order" — a taste-aware ordering guide on the detail page.
 *
 * Renders entirely from the full record the page already holds — **no network,
 * no skeleton, no reorder**. Each pick's rich description is pre-stored at ingest
 * (`Restaurant.dishDescriptions`) and the personalized taste line is computed
 * locally, so the guide is instant and stable. (We dropped the old request-time
 * `/api/order` Claude upgrade because it added a ~6–7s delay and visibly
 * reshuffled the picks after load — see
 * `docs/decisions/2026-06-21-prestored-dish-descriptions.md`.) Honesty: picks
 * only ever come from the restaurant's real signature dishes, and we always pair
 * them with a confirm-with-staff note since our data isn't an authoritative menu.
 */
export default function OrderGuide({ restaurant: r }: { restaurant: Restaurant }) {
  const profile = useStore((s) => s.profile);
  const guide = useMemo(() => buildLocalOrderGuide(r, profile), [r, profile]);
  // Which dish rows are expanded. Collapsed by default — each row is a tappable
  // accordion so the section reads as a tidy list of dish names until opened.
  const [open, setOpen] = useState<Set<string>>(() => new Set());

  // No dishes to show — render nothing. (The insider tip lives in its own card,
  // so we don't repeat the guide's intro here.)
  if (!guide.picks.length) return null;

  return (
    <div className="px-5 pt-5">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink-faint">
        <UtensilsIcon width={15} height={15} /> What to order
      </h2>
      <ul className="mt-3 space-y-2">
        {guide.picks.map((p) => {
          const isOpen = open.has(p.dish);
          const hasCaution = !!p.cautions && p.cautions.length > 0;
          const panelId = `order-${r.id}-${p.dish}`.replace(/\s+/g, "-");
          return (
            <li
              key={p.dish}
              className="overflow-hidden rounded-2xl border border-line bg-paper-raised"
            >
              <button
                type="button"
                onClick={() =>
                  setOpen((prev) => {
                    const next = new Set(prev);
                    next.has(p.dish) ? next.delete(p.dish) : next.add(p.dish);
                    return next;
                  })
                }
                aria-expanded={isOpen}
                aria-controls={panelId}
                className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left"
              >
                <span className="min-w-0 flex-1 text-sm font-semibold text-ink">
                  {p.dish}
                </span>
                {hasCaution && (
                  <span
                    className="shrink-0 text-olive-deep"
                    aria-label="Has an allergen caution"
                    title="Allergen caution — tap to read"
                  >
                    ◷
                  </span>
                )}
                <ChevronDownIcon
                  width={16}
                  height={16}
                  className={`shrink-0 text-ink-faint transition-transform ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
              {isOpen && (
                <div id={panelId} className="px-3.5 pb-2.5 -mt-0.5">
                  {/* The pre-stored description carries the dish. Fall back to the
                      local taste line only when no description exists, so the
                      panel is never empty (and we don't double up when it does). */}
                  <p className="text-xs leading-relaxed text-ink-soft">
                    {p.desc ?? p.why}
                  </p>
                  {p.note && (
                    <div className="mt-1 text-[11px] text-ink-faint">
                      ★ Reviewers love it for {p.note}
                    </div>
                  )}
                  {hasCaution && (
                    <div className="mt-1.5 text-[11px] font-semibold text-olive-deep">
                      ◷ May contain {p.cautions!.join(", ")} — ask the kitchen.
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
        Menus change — confirm any allergies or dietary needs with the restaurant.
      </p>
    </div>
  );
}
