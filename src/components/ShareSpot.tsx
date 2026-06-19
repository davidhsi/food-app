"use client";

import { useState } from "react";
import { Restaurant } from "@/lib/types";
import { track } from "@/lib/analytics";
import { ShareIcon } from "./icons";

export default function ShareSpot({ restaurant: r }: { restaurant: Restaurant }) {
  const [copied, setCopied] = useState(false);

  const share = () => {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/restaurant/${r.id}`
        : "";
    const text = `${r.name} — ${r.cuisines.join(", ")} · ${r.neighborhood}. A hidden gem I found on Truffle.`;
    const canShare =
      typeof navigator !== "undefined" && typeof navigator.share === "function";
    track("share_spot", { id: r.id, method: canShare ? "web_share" : "clipboard" });
    if (canShare) {
      navigator.share({ title: r.name, text, url }).catch(() => {});
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      // No native share sheet to confirm the action, so confirm it ourselves.
      navigator.clipboard
        .writeText(`${text} ${url}`)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        })
        .catch(() => {});
    }
  };

  return (
    <div className="relative">
      {copied && (
        <span
          role="status"
          className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-ink px-2.5 py-1 text-[11px] font-medium text-paper"
        >
          Link copied
        </span>
      )}
      <button
        type="button"
        onClick={share}
        aria-label={`Share ${r.name}`}
        className="grid h-12 w-12 place-items-center rounded-full bg-paper-raised text-ink ring-1 ring-line active:scale-95"
      >
        <ShareIcon width={20} height={20} />
      </button>
    </div>
  );
}
