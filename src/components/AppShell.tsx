"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import BottomNav from "./BottomNav";

/**
 * Phone-framed shell with bottom navigation. Redirects to onboarding until the
 * user has set up a taste profile. `bare` skips the nav (used by detail pages).
 */
export default function AppShell({
  children,
  bare = false,
  requireOnboard = true,
}: {
  children: React.ReactNode;
  bare?: boolean;
  requireOnboard?: boolean;
}) {
  const onboarded = useStore((s) => s.onboarded);
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => setHydrated(true), []);

  useEffect(() => {
    if (hydrated && requireOnboard && !onboarded) {
      router.replace("/onboarding");
    }
  }, [hydrated, onboarded, requireOnboard, router]);

  if (!hydrated) {
    return (
      <div className="phone-shell flex items-center justify-center">
        <div className="animate-pulse text-2xl font-black tracking-tight">
          Reel<span className="text-brand">Eats</span>
        </div>
      </div>
    );
  }

  return (
    <div className="phone-shell">
      <div className="absolute inset-0">{children}</div>
      {!bare && <BottomNav />}
    </div>
  );
}
