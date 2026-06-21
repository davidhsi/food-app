"use client";

import { SearchIcon, XIcon, UtensilsIcon } from "@/components/icons";
import { ALL_CUISINES } from "@/lib/data";
import { useStore } from "@/lib/store";
import { track } from "@/lib/analytics";
import FilterSelect from "./FilterSelect";
import NeighborhoodFilter from "./NeighborhoodFilter";

/**
 * The Discover home's sticky filter hub: a search box plus a single row of
 * filter pills. The text box and the cuisine pill write to the store's
 * ephemeral search state and flip the home into search/results mode when active;
 * the neighborhood pill is a browse-only steer (it never enters search mode), so
 * it's hidden once results are showing to avoid implying a filter that the
 * results branch doesn't apply.
 */
export default function SearchBar() {
  const q = useStore((s) => s.searchQuery);
  const cuisine = useStore((s) => s.searchCuisine);
  const submitted = useStore((s) => s.searchSubmitted);
  const setSearch = useStore((s) => s.setSearch);

  const searchActive = submitted.trim() !== "" || cuisine !== null;

  return (
    <div
      className={`sticky top-0 z-30 bg-paper/95 px-4 pb-2 backdrop-blur-md ${
        searchActive ? "pt-4" : "pt-2"
      }`}
    >
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

      <div className="mt-3 flex items-center gap-2">
        {!searchActive && <NeighborhoodFilter />}
        <FilterSelect
          label="Cuisine"
          value={cuisine}
          options={ALL_CUISINES}
          allLabel="Any cuisine"
          icon={<UtensilsIcon width={13} height={13} />}
          onChange={(c) => setSearch({ searchCuisine: c })}
        />
      </div>
    </div>
  );
}
