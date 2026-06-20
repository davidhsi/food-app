"use client";

import { SearchIcon, XIcon } from "@/components/icons";
import { ALL_CUISINES } from "@/lib/data";
import { useStore } from "@/lib/store";
import { track } from "@/lib/analytics";

/**
 * The Discover home's search affordance: a sticky text box plus the cuisine
 * filter row. Both write to the store's ephemeral search state (so they survive
 * navigating into a restaurant and back), and either one being active flips the
 * home from browse mode into search/results mode — the page reads the same store
 * fields to decide. Self-contained like NeighborhoodChips.
 */
export default function SearchBar() {
  const q = useStore((s) => s.searchQuery);
  const cuisine = useStore((s) => s.searchCuisine);
  const setSearch = useStore((s) => s.setSearch);

  return (
    <div className="sticky top-0 z-30 bg-paper/95 px-4 pb-2 pt-4 backdrop-blur-md">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSearch({ searchSubmitted: q });
          if (q.trim()) track("search_submit", { query: q.trim().slice(0, 80) });
        }}
        role="search"
        className="flex items-center gap-2 rounded-full bg-paper-raised px-4 py-2.5 ring-1 ring-line"
      >
        <SearchIcon width={18} height={18} className="text-ink-faint" />
        <input
          type="search"
          value={q}
          onChange={(e) => setSearch({ searchQuery: e.target.value })}
          placeholder="Search dishes, vibes, places…"
          aria-label="Search dishes, vibes, or places"
          className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint focus:ring-0 [&::-webkit-search-cancel-button]:hidden"
        />
        {q && (
          <button
            type="button"
            onClick={() => setSearch({ searchQuery: "", searchSubmitted: "" })}
            aria-label="Clear search"
            className="-mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-faint active:scale-90"
          >
            <XIcon width={16} height={16} />
          </button>
        )}
      </form>

      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto [mask-image:linear-gradient(to_right,black_92%,transparent)]">
        <button
          onClick={() => setSearch({ searchCuisine: null })}
          className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${
            !cuisine
              ? "bg-olive text-paper"
              : "bg-paper-raised text-ink-soft ring-1 ring-line"
          }`}
        >
          All
        </button>
        {ALL_CUISINES.map((c) => (
          <button
            key={c}
            onClick={() => setSearch({ searchCuisine: cuisine === c ? null : c })}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${
              cuisine === c
                ? "bg-olive text-paper"
                : "bg-paper-raised text-ink-soft ring-1 ring-line"
            }`}
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}
