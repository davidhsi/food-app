"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import AppShell from "@/components/AppShell";
import { track } from "@/lib/analytics";

// Leaflet touches `window` at module load, so the map is client-only.
const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center bg-paper">
      <div className="animate-pulse font-display text-lg font-semibold text-ink-faint">
        Loading map…
      </div>
    </div>
  ),
});

export default function MapPage() {
  useEffect(() => {
    track("map_open");
  }, []);

  return (
    <AppShell>
      <div className="relative h-full w-full">
        <header className="pointer-events-none absolute inset-x-0 top-0 z-[1000] bg-gradient-to-b from-paper/90 to-transparent px-5 pb-6 pt-9">
          <div className="font-display text-2xl font-semibold tracking-tight text-ink">
            Map<span className="text-olive">.</span>
          </div>
          <p className="mt-0.5 text-[13px] text-ink-soft">
            Your saved spots, places you&apos;ve been, and gems nearby
          </p>
        </header>
        <div className="absolute inset-0 pb-16">
          <MapView />
        </div>
      </div>
    </AppShell>
  );
}
