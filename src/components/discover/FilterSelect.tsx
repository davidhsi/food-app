"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDownIcon, CheckIcon } from "@/components/icons";

interface FilterSelectProps {
  /** Heading / aria context for the control, e.g. "Neighborhood". */
  label: string;
  /** Current selection; `null` means the unfiltered "all" state. */
  value: string | null;
  options: readonly string[];
  /** Label for the null/all option (and the pill when nothing is chosen). */
  allLabel: string;
  onChange: (value: string | null) => void;
  /** Optional leading glyph on the pill, to distinguish twin filters. */
  icon?: ReactNode;
  /** Transient override for the pill text (e.g. "Locating…"); menu is unaffected. */
  pillLabel?: string;
}

/**
 * A compact filter control for the Discover home: a pill that shows the current
 * selection and opens a token-styled menu anchored beneath it. Replaces the old
 * horizontal chip strips — the pill label keeps the active choice visible (chips
 * made you scroll to find it) and one row now holds both the neighborhood and
 * cuisine filters. The menu is anchored (not a bottom sheet) so it isn't clipped
 * by the home's scroll container; it closes on outside-click, Escape, or select.
 */
export default function FilterSelect({
  label,
  value,
  options,
  allLabel,
  onChange,
  icon,
  pillLabel,
}: FilterSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const active = value !== null;
  const choose = (v: string | null) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${value ?? allLabel}`}
        className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${
          active
            ? "bg-olive text-paper"
            : "bg-paper-raised text-ink-soft ring-1 ring-line"
        }`}
      >
        {icon}
        <span>{pillLabel ?? value ?? allLabel}</span>
        <ChevronDownIcon
          width={13}
          height={13}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={label}
          className="absolute left-0 top-full z-40 mt-2 max-h-[52vh] w-44 overflow-y-auto rounded-2xl border border-line bg-paper-raised p-1.5 shadow-xl animate-floatUp"
        >
          <Option
            label={allLabel}
            selected={value === null}
            onClick={() => choose(null)}
          />
          {options.map((o) => (
            <Option
              key={o}
              label={o}
              selected={value === o}
              onClick={() => choose(o)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Option({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm ${
        selected ? "font-semibold text-olive-deep" : "text-ink"
      }`}
    >
      <span className="truncate">{label}</span>
      {selected && (
        <CheckIcon width={15} height={15} className="shrink-0 text-olive" />
      )}
    </button>
  );
}
