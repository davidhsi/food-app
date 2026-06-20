"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { RESTAURANTS, getRestaurant } from "@/lib/data";
import { gemScore, Restaurant } from "@/lib/types";
import { useStore } from "@/lib/store";
import { haversineKm, CHICAGO_CENTER } from "@/lib/geo";
import { track } from "@/lib/analytics";
import { BookmarkIcon, PinIcon, XIcon } from "@/components/icons";

type Category = "been" | "saved" | "nearby";

interface Pin {
  r: Restaurant;
  category: Category;
  score?: number; // user's 0–10 rank, for "been" spots
}

type LatLng = { lat: number; lng: number };

// Keep the personal map small and honest: the user's been/saved spots always,
// plus the nearest high-gem spots around the current center. No clustering, no
// counts — see the design spec.
const NEARBY_POOL = 150; // nearest-by-distance shortlist...
const NEARBY_CAP = 40; // ...then the top gems within it.

function buildPins(
  saved: string[],
  ranked: { restaurantId: string; score: number }[],
  center: LatLng,
): Pin[] {
  const used = new Set<string>();
  const pins: Pin[] = [];

  // Priority 1: places you've been (carry your 0–10 rank).
  for (const e of ranked) {
    const r = getRestaurant(e.restaurantId);
    if (r && !used.has(r.id)) {
      used.add(r.id);
      pins.push({ r, category: "been", score: e.score });
    }
  }
  // Priority 2: saved "want to try".
  for (const id of saved) {
    const r = getRestaurant(id);
    if (r && !used.has(r.id)) {
      used.add(r.id);
      pins.push({ r, category: "saved" });
    }
  }
  // Priority 3: nearby gems — nearest shortlist, then most under-the-radar.
  const nearby = RESTAURANTS.filter((r) => !used.has(r.id))
    .map((r) => ({ r, d: haversineKm(center.lat, center.lng, r.lat, r.lng) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, NEARBY_POOL)
    .sort((a, b) => gemScore(b.r) - gemScore(a.r))
    .slice(0, NEARBY_CAP);
  for (const { r } of nearby) pins.push({ r, category: "nearby" });

  return pins;
}

// Markers are raw HTML (Leaflet renders them outside React), so we lean on the
// global Tailwind utilities — the token classes below appear as literals so JIT
// keeps them. No raw hex.
function markerIcon(pin: Pin, active: boolean): L.DivIcon {
  const ring = active ? "ring-ink" : "ring-paper";
  if (pin.category === "been") {
    return L.divIcon({
      className: "",
      html: `<span class="grid h-5 min-w-[20px] place-items-center rounded-full bg-olive-deep px-1 text-[10px] font-semibold leading-none text-paper shadow ring-2 ${ring}">${
        pin.score?.toFixed(1) ?? ""
      }</span>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
  }
  if (pin.category === "saved") {
    return L.divIcon({
      className: "",
      html: `<span class="block h-3.5 w-3.5 rounded-full bg-gem shadow ring-2 ${ring}"></span>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
  }
  return L.divIcon({
    className: "",
    html: `<span class="block h-2.5 w-2.5 rounded-full bg-olive shadow ring-2 ${ring}"></span>`,
    iconSize: [10, 10],
    iconAnchor: [5, 5],
  });
}

const userIcon = L.divIcon({
  className: "",
  html: `<span class="block h-3 w-3 rounded-full bg-ink ring-4 ring-ink/20"></span>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

/** Imperatively keeps the Leaflet view in sync with our React center/zoom. */
function Recenter({ center, zoom }: { center: LatLng; zoom: number }) {
  const map = useMap();
  // Container is absolutely positioned, so size can be 0 at first paint.
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 0);
    return () => clearTimeout(t);
  }, [map]);
  useEffect(() => {
    map.setView([center.lat, center.lng], zoom);
  }, [center.lat, center.lng, zoom, map]);
  return null;
}

/** Mean of a neighborhood's spots, falling back to the city center. */
function neighborhoodCenter(neighborhood: string | null): LatLng {
  if (!neighborhood) return CHICAGO_CENTER;
  const inArea = RESTAURANTS.filter((r) => r.neighborhood === neighborhood);
  if (inArea.length === 0) return CHICAGO_CENTER;
  const lat = inArea.reduce((s, r) => s + r.lat, 0) / inArea.length;
  const lng = inArea.reduce((s, r) => s + r.lng, 0) / inArea.length;
  return { lat, lng };
}

const priceStr = (p: number) => "$".repeat(p);

export default function MapView() {
  const saved = useStore((s) => s.saved);
  const ranked = useStore((s) => s.ranked);
  const neighborhood = useStore((s) => s.neighborhood);
  const toggleSave = useStore((s) => s.toggleSave);

  const fallback = useMemo(
    () => neighborhoodCenter(neighborhood),
    [neighborhood],
  );
  const [center, setCenter] = useState<LatLng>(fallback);
  const [zoom, setZoom] = useState(13);
  const [userPos, setUserPos] = useState<LatLng | null>(null);
  const [selected, setSelected] = useState<Pin | null>(null);

  const locate = () => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserPos(p);
        setCenter(p);
        setZoom(14);
      },
      () => {
        /* denied/unavailable — keep the neighborhood/city fallback */
      },
      { maximumAge: 300000, timeout: 8000 },
    );
  };

  // Ask once on mount (same gentle pattern as the detail page distance).
  useEffect(() => {
    locate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pins = useMemo(
    () => buildPins(saved, ranked, center),
    [saved, ranked, center],
  );

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        zoomControl={false}
        scrollWheelZoom
        className="h-full w-full bg-paper"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        <Recenter center={center} zoom={zoom} />
        {userPos && <Marker position={[userPos.lat, userPos.lng]} icon={userIcon} />}
        {pins.map((pin) => (
          <Marker
            key={pin.r.id}
            position={[pin.r.lat, pin.r.lng]}
            icon={markerIcon(pin, selected?.r.id === pin.r.id)}
            eventHandlers={{
              click: () => {
                track("map_pin_tap", { id: pin.r.id, category: pin.category });
                setSelected(pin);
              },
            }}
          />
        ))}
      </MapContainer>

      {/* Legend */}
      <div className="pointer-events-none absolute left-3 top-[68px] z-[1000] flex flex-col gap-1 rounded-2xl border border-line bg-paper-raised/90 px-3 py-2 text-[11px] text-ink-soft shadow-sm backdrop-blur">
        <span className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded-full bg-gem ring-2 ring-paper" /> Saved
        </span>
        <span className="flex items-center gap-1.5">
          <span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-olive-deep ring-2 ring-paper" /> Been
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-olive ring-2 ring-paper" /> Nearby gem
        </span>
      </div>

      {/* Locate me */}
      <button
        type="button"
        onClick={locate}
        aria-label="Center on my location"
        className="absolute right-3 top-[68px] z-[1000] grid h-11 w-11 place-items-center rounded-full border border-line bg-paper-raised/90 text-olive shadow-sm backdrop-blur active:scale-90 transition-transform"
      >
        <PinIcon width={20} height={20} />
      </button>

      {/* Selected spot card */}
      {selected && (
        <div className="absolute inset-x-3 bottom-[84px] z-[1000] animate-floatUp">
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-paper-raised/95 p-2.5 shadow-xl backdrop-blur">
            <Link
              href={`/restaurant/${selected.r.id}`}
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
            >
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-line">
                {selected.r.reels[0]?.poster && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selected.r.reels[0].poster}
                    alt={selected.r.name}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-lg font-semibold leading-tight text-ink">
                  {selected.r.name}
                </div>
                <div className="mt-0.5 truncate text-[12px] text-ink-soft">
                  <span className="font-semibold text-olive">
                    <span aria-hidden="true">★</span> {selected.r.rating.toFixed(1)}
                  </span>{" "}
                  · <span aria-hidden="true">◆</span> {(gemScore(selected.r) * 10).toFixed(1)} ·{" "}
                  {priceStr(selected.r.price)} · {selected.r.neighborhood}
                </div>
                {selected.category === "been" && selected.score !== undefined && (
                  <div className="mt-0.5 text-[11px] font-medium text-olive-deep">
                    Your rank · {selected.score.toFixed(1)}
                  </div>
                )}
              </div>
            </Link>
            <SaveButton id={selected.r.id} toggleSave={toggleSave} />
            <button
              type="button"
              onClick={() => setSelected(null)}
              aria-label="Close"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-faint active:scale-90 transition-transform"
            >
              <XIcon width={18} height={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SaveButton({
  id,
  toggleSave,
}: {
  id: string;
  toggleSave: (id: string) => void;
}) {
  const isSaved = useStore((s) => s.saved.includes(id));
  return (
    <button
      type="button"
      onClick={() => {
        track("save_toggle", { id, saved: !isSaved, source: "map" });
        toggleSave(id);
      }}
      aria-label={isSaved ? "Remove from want to try" : "Save to want to try"}
      aria-pressed={isSaved}
      className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-paper text-ink ring-1 ring-line active:scale-90 transition-transform"
    >
      <BookmarkIcon filled={isSaved} width={16} height={16} />
    </button>
  );
}
