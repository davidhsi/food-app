"use client";

import { Restaurant } from "@/lib/types";
import { ShareIcon } from "./icons";

export default function ShareSpot({ restaurant: r }: { restaurant: Restaurant }) {
  const share = () => {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/restaurant/${r.id}`
        : "";
    const text = `${r.name} — ${r.cuisines.join(", ")} · ${r.neighborhood}. A hidden gem I found on Truffle.`;
    if (typeof navigator !== "undefined" && navigator.share) {
      navigator.share({ title: r.name, text, url }).catch(() => {});
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(`${text} ${url}`).catch(() => {});
    }
  };

  return (
    <button
      type="button"
      onClick={share}
      aria-label={`Share ${r.name}`}
      className="grid h-12 w-12 place-items-center rounded-full bg-paper-raised text-ink ring-1 ring-line active:scale-95"
    >
      <ShareIcon width={20} height={20} />
    </button>
  );
}
