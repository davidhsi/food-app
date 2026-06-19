"use client";

import { useEffect } from "react";

/**
 * Route-level error boundary. Catches render/runtime errors (e.g. a corrupted
 * persisted store) and offers recovery instead of a blank screen.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error boundary:", error);
  }, [error]);

  return (
    <div className="phone-shell flex flex-col items-center justify-center bg-paper px-8 text-center">
      <div className="font-display text-5xl font-semibold tracking-tight text-ink">
        Truffle<span className="text-olive">.</span>
      </div>
      <h1 className="mt-6 font-display text-xl font-semibold text-ink">
        Something went sideways
      </h1>
      <p className="mt-2 text-sm text-ink-soft">
        A hiccup on our end. Try again — your saved spots and taste profile are safe.
      </p>
      <div className="mt-7 flex gap-2">
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-olive px-6 py-3 text-sm font-semibold text-paper active:scale-95"
        >
          Try again
        </button>
        <a
          href="/feed"
          className="rounded-full bg-paper-raised px-6 py-3 text-sm font-semibold text-ink ring-1 ring-line active:scale-95"
        >
          Back to feed
        </a>
      </div>
    </div>
  );
}
