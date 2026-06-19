"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { track } from "@/lib/analytics";
import { NEIGHBORHOODS, nearestNeighborhood } from "@/lib/neighborhoods";

/**
 * Feed neighborhood selector. Renders "Anywhere" + the 9 areas as a scrollable
 * chip row and soft-steers the feed via the store. On first visit only (while
 * untouched), it runs one fail-silent geolocation read and pre-selects the
 * nearest neighborhood — mirroring the UserDistance pattern.
 */
export default function NeighborhoodChips() {
  const neighborhood = useStore((s) => s.neighborhood);
  const touched = useStore((s) => s.neighborhoodTouched);
  const setNeighborhood = useStore((s) => s.setNeighborhood);

  useEffect(() => {
    if (touched) return;
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Bail if the user tapped a chip during the permission prompt.
        if (useStore.getState().neighborhoodTouched) return;
        setNeighborhood(
          nearestNeighborhood(pos.coords.latitude, pos.coords.longitude),
        );
      },
      () => {},
      { maximumAge: 300000, timeout: 5000 },
    );
  }, [touched, setNeighborhood]);

  // User-initiated selection (distinct from the silent geolocation pre-select).
  const select = (name: string | null) => {
    track("neighborhood_select", { neighborhood: name ?? "anywhere" });
    setNeighborhood(name);
  };

  const chip = (
    label: string,
    active: boolean,
    onClick: () => void,
    clearable = false,
  ) => (
    <button
      key={label}
      onClick={onClick}
      aria-pressed={active}
      aria-label={active && clearable ? `${label} — tap to clear` : undefined}
      className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${
        active
          ? "bg-olive text-paper"
          : "bg-paper-raised text-ink-soft ring-1 ring-line"
      }`}
    >
      {label}
      {active && clearable && (
        <span aria-hidden="true" className="ml-1 opacity-80">
          ×
        </span>
      )}
    </button>
  );

  return (
    <div
      className="no-scrollbar mb-1 flex gap-2 overflow-x-auto px-5 pb-1 [mask-image:linear-gradient(to_right,black_92%,transparent)]"
      aria-label="Filter feed by neighborhood"
    >
      {chip("Anywhere", neighborhood === null, () => select(null))}
      {NEIGHBORHOODS.map((n) =>
        // Tapping the active chip clears the steer back to "Anywhere".
        chip(
          n,
          neighborhood === n,
          () => select(neighborhood === n ? null : n),
          true,
        ),
      )}
    </div>
  );
}
