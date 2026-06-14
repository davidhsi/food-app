"use client";

import { useEffect, useState } from "react";
import { haversineKm } from "@/lib/geo";

/**
 * Shows live "X km away" when the user grants geolocation; otherwise renders
 * nothing (the caller already shows the neighborhood). No prompt is forced —
 * we only read a position the browser will give us.
 */
export default function UserDistance({ lat, lng }: { lat: number; lng: number }) {
  const [km, setKm] = useState<number | null>(null);

  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setKm(haversineKm(pos.coords.latitude, pos.coords.longitude, lat, lng)),
      () => setKm(null),
      { maximumAge: 300000, timeout: 5000 },
    );
  }, [lat, lng]);

  if (km === null) return null;
  return <span> · {km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`} away</span>;
}
