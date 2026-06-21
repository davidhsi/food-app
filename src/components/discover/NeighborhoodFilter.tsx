"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { track } from "@/lib/analytics";
import { NEIGHBORHOODS, resolveNearbyNeighborhood } from "@/lib/neighborhoods";
import { PinIcon } from "@/components/icons";
import FilterSelect from "./FilterSelect";

/** Synthetic menu item — a location steer rather than a named area. */
const NEAR_ME = "Near me";

/**
 * The Discover home's neighborhood steer, as a single dropdown pill (was a
 * horizontal chip strip). A soft browse steer — picking an area re-weights the
 * feed and adds an "In {area}" shelf; it never flips the page into search mode.
 *
 * Defaults to "Near me": on first visit it runs one fail-silent geolocation read
 * and, if granted, enters Near-me mode (the pill reads "Near me", the feed steers
 * to the resolved nearest area). If location is denied or unavailable it stays on
 * "Anywhere" — we never label results "Near me" without an actual fix. Tapping
 * "Near me" in the menu re-requests location, so a denied first read is
 * recoverable.
 */
export default function NeighborhoodFilter() {
  const neighborhood = useStore((s) => s.neighborhood);
  const nearMe = useStore((s) => s.neighborhoodNearMe);
  const touched = useStore((s) => s.neighborhoodTouched);
  const setNeighborhood = useStore((s) => s.setNeighborhood);
  const setNearMe = useStore((s) => s.setNearMe);

  // Transient status for an explicit "Near me" tap, so the control gives visible
  // feedback instead of silently doing nothing when geolocation is slow or off.
  const [status, setStatus] = useState<null | "locating" | "denied">(null);

  useEffect(() => {
    if (touched) return;
    resolveNearbyNeighborhood().then((n) => {
      // Bail if the user opened the picker during the permission prompt.
      if (n && !useStore.getState().neighborhoodTouched) setNearMe(n);
    });
  }, [touched, setNearMe]);

  const enterNearMe = () => {
    track("neighborhood_select", { neighborhood: "near-me" });
    setStatus("locating");
    resolveNearbyNeighborhood().then((n) => {
      if (n) {
        setStatus(null);
        setNearMe(n);
      } else {
        // Denied / unavailable: don't fake a location. Show a brief cue, then
        // clear it (the prior selection stays put).
        setStatus("denied");
        setTimeout(() => setStatus(null), 2500);
      }
    });
  };

  const pillLabel =
    status === "locating"
      ? "Locating…"
      : status === "denied"
        ? "Location off"
        : undefined;

  return (
    <FilterSelect
      label="Neighborhood"
      value={nearMe ? NEAR_ME : neighborhood}
      options={[NEAR_ME, ...NEIGHBORHOODS]}
      allLabel="Anywhere"
      icon={<PinIcon width={13} height={13} />}
      pillLabel={pillLabel}
      onChange={(name) => {
        if (name === NEAR_ME) {
          enterNearMe();
          return;
        }
        track("neighborhood_select", { neighborhood: name ?? "anywhere" });
        setNeighborhood(name);
      }}
    />
  );
}
