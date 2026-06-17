"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DishRank, RankedEntry, TasteProfile } from "./types";
import { insertDishRank, insertRanked } from "./ranking";

export const DEFAULT_PROFILE: TasteProfile = {
  cuisines: [],
  price: [1, 2, 3],
  vibes: [],
  dietary: [],
  allergies: [],
  spiceTolerance: 1,
  adventurousness: 0.5,
  // Default to leaning toward hidden gems — it's the product's whole point.
  undergroundBias: 0.7,
};

interface AppState {
  onboarded: boolean;
  profile: TasteProfile;
  liked: string[];
  saved: string[]; // "want to try"
  ranked: RankedEntry[]; // "been", sorted desc by score
  seen: string[];
  neighborhood: string | null; // null = "Anywhere" (no steer)
  neighborhoodTouched: boolean; // true once the user has chosen, incl. "Anywhere"
  // Personal, local-only dish rankings: restaurantId -> dishes ranked desc.
  dishRanks: Record<string, DishRank[]>;

  completeOnboarding: (p: TasteProfile) => void;
  setProfile: (p: TasteProfile) => void;
  toggleLike: (id: string) => void;
  toggleSave: (id: string) => void;
  markSeen: (id: string) => void;
  setNeighborhood: (name: string | null) => void;
  addRanked: (id: string, insertAt: number) => void;
  removeRanked: (id: string) => void;
  rankDish: (restaurantId: string, dish: string, insertAt: number) => void;
  removeDishRank: (restaurantId: string, dish: string) => void;
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
      neighborhood: null,
      neighborhoodTouched: false,
      dishRanks: {},

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

      setNeighborhood: (name) =>
        set({ neighborhood: name, neighborhoodTouched: true }),

      addRanked: (id, insertAt) =>
        set((s) => ({
          ranked: insertRanked(s.ranked, id, insertAt),
          saved: s.saved.filter((x) => x !== id), // graduating from want -> been
        })),

      removeRanked: (id) =>
        set((s) => ({ ranked: s.ranked.filter((e) => e.restaurantId !== id) })),

      rankDish: (restaurantId, dish, insertAt) =>
        set((s) => {
          const current = s.dishRanks[restaurantId] ?? [];
          return {
            dishRanks: {
              ...s.dishRanks,
              [restaurantId]: insertDishRank(current, dish, insertAt),
            },
          };
        }),

      removeDishRank: (restaurantId, dish) =>
        set((s) => {
          const current = s.dishRanks[restaurantId];
          if (!current) return s;
          const next = current.filter((e) => e.dish !== dish);
          const dishRanks = { ...s.dishRanks };
          if (next.length) dishRanks[restaurantId] = next;
          else delete dishRanks[restaurantId];
          return { dishRanks };
        }),

      reset: () =>
        set({
          onboarded: false,
          profile: DEFAULT_PROFILE,
          liked: [],
          saved: [],
          ranked: [],
          seen: [],
          neighborhood: null,
          neighborhoodTouched: false,
          dishRanks: {},
        }),
    }),
    { name: "truffle-store" },
  ),
);
