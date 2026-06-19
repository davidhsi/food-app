"use client";

import { useCallback, useRef } from "react";

/**
 * Remembers the scroll position of an inner scroll container and restores it
 * when the component remounts (e.g. tapping a recommendation and pressing back).
 *
 * The app scrolls inside inset children, not the window, so the browser's own
 * scroll restoration doesn't apply. Positions live in a module-level map: they
 * persist across in-app navigation but reset on a full reload — matching how the
 * search/concierge state is kept in-memory.
 *
 * Returns a callback ref to spread onto the scrollable element.
 */
const positions = new Map<string, number>();

export function useScrollRestoration<T extends HTMLElement>(key: string) {
  const cleanup = useRef<(() => void) | null>(null);

  return useCallback(
    (el: T | null) => {
      // Element detaching (unmount/navigation): persist final position.
      if (cleanup.current) {
        cleanup.current();
        cleanup.current = null;
      }
      if (!el) return;

      const onScroll = () => positions.set(key, el.scrollTop);
      el.addEventListener("scroll", onScroll, { passive: true });
      cleanup.current = () => {
        positions.set(key, el.scrollTop);
        el.removeEventListener("scroll", onScroll);
      };

      const saved = positions.get(key);
      if (saved) {
        // Restore after the first paint so the content has laid out.
        requestAnimationFrame(() => {
          el.scrollTop = saved;
        });
      }
    },
    [key],
  );
}
