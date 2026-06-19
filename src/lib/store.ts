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
  allergies: [],
  spiceTolerance: 1,
  adventurousness: 0.5,
  // Default to leaning toward hidden gems — it's the product's whole point.
  undergroundBias: 0.7,
};

export interface AssistantMsg {
  role: "user" | "assistant";
  text: string;
  restaurantIds?: string[];
  engine?: string;
}

interface AppState {
  onboarded: boolean;
  profile: TasteProfile;
  liked: string[];
  saved: string[]; // "want to try"
  ranked: RankedEntry[]; // "been", sorted desc by score
  seen: string[];
  neighborhood: string | null; // null = "Anywhere" (no steer)
  neighborhoodTouched: boolean; // true once the user has chosen, incl. "Anywhere"

  // Ephemeral UI state kept in the store (not local component state) so it
  // survives navigating into a restaurant and back. Excluded from persistence
  // (see partialize) — a fresh app open starts blank.
  searchQuery: string;
  searchSubmitted: string;
  searchCuisine: string | null;
  searchGeoNbhd: string | null;
  assistantMessages: AssistantMsg[];

  completeOnboarding: (p: TasteProfile) => void;
  setProfile: (p: TasteProfile) => void;
  toggleLike: (id: string) => void;
  toggleSave: (id: string) => void;
  markSeen: (id: string) => void;
  setNeighborhood: (name: string | null) => void;
  setSearch: (
    patch: Partial<
      Pick<
        AppState,
        "searchQuery" | "searchSubmitted" | "searchCuisine" | "searchGeoNbhd"
      >
    >,
  ) => void;
  setAssistantMessages: (
    m: AssistantMsg[] | ((prev: AssistantMsg[]) => AssistantMsg[]),
  ) => void;
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
      neighborhood: null,
      neighborhoodTouched: false,
      searchQuery: "",
      searchSubmitted: "",
      searchCuisine: null,
      searchGeoNbhd: null,
      assistantMessages: [],

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

      setSearch: (patch) => set(patch),
      setAssistantMessages: (m) =>
        set((s) => ({
          assistantMessages:
            typeof m === "function" ? m(s.assistantMessages) : m,
        })),

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
          neighborhood: null,
          neighborhoodTouched: false,
          searchQuery: "",
          searchSubmitted: "",
          searchCuisine: null,
          searchGeoNbhd: null,
          assistantMessages: [],
        }),
    }),
    {
      name: "truffle-store",
      // Persist only durable user data — keep ephemeral search/concierge UI
      // state in memory so it survives navigation but resets on a fresh open.
      partialize: (s) => ({
        onboarded: s.onboarded,
        profile: s.profile,
        liked: s.liked,
        saved: s.saved,
        ranked: s.ranked,
        seen: s.seen,
        neighborhood: s.neighborhood,
        neighborhoodTouched: s.neighborhoodTouched,
      }),
    },
  ),
);
