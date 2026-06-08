"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { RankedEntry, TasteProfile } from "./types";
import { insertRanked } from "./ranking";

export const DEFAULT_PROFILE: TasteProfile = {
  cuisines: [],
  price: [1, 2, 3],
  vibes: [],
  dietary: [],
  spiceTolerance: 1,
  adventurousness: 0.5,
};

interface AppState {
  onboarded: boolean;
  profile: TasteProfile;
  liked: string[];
  saved: string[]; // "want to try"
  ranked: RankedEntry[]; // "been", sorted desc by score
  seen: string[];

  completeOnboarding: (p: TasteProfile) => void;
  setProfile: (p: TasteProfile) => void;
  toggleLike: (id: string) => void;
  toggleSave: (id: string) => void;
  markSeen: (id: string) => void;
  addRanked: (id: string, insertAt: number) => void;
  removeRanked: (id: string) => void;
  reset: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      onboarded: false,
      profile: DEFAULT_PROFILE,
      liked: [],
      saved: [],
      ranked: [],
      seen: [],

      completeOnboarding: (p) => set({ profile: p, onboarded: true }),
      setProfile: (p) => set({ profile: p }),

      toggleLike: (id) =>
        set((s) => ({
          liked: s.liked.includes(id)
            ? s.liked.filter((x) => x !== id)
            : [...s.liked, id],
        })),

      toggleSave: (id) =>
        set((s) => ({
          saved: s.saved.includes(id)
            ? s.saved.filter((x) => x !== id)
            : [...s.saved, id],
        })),

      markSeen: (id) =>
        set((s) =>
          s.seen.includes(id) ? s : { seen: [...s.seen, id].slice(-200) },
        ),

      addRanked: (id, insertAt) =>
        set((s) => ({
          ranked: insertRanked(s.ranked, id, insertAt),
          saved: s.saved.filter((x) => x !== id), // graduating from want -> been
        })),

      removeRanked: (id) =>
        set((s) => ({ ranked: s.ranked.filter((e) => e.restaurantId !== id) })),

      reset: () =>
        set({
          onboarded: false,
          profile: DEFAULT_PROFILE,
          liked: [],
          saved: [],
          ranked: [],
          seen: [],
        }),
    }),
    { name: "reeleats-store" },
  ),
);
