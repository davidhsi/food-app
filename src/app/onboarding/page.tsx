"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStore, DEFAULT_PROFILE } from "@/lib/store";
import { ALL_CUISINES } from "@/lib/data";
import { track } from "@/lib/analytics";
import { Cuisine, Dietary, Price, TasteProfile, Vibe } from "@/lib/types";

const VIBES: { v: Vibe; label: string }[] = [
  { v: "trendy", label: "Trendy" },
  { v: "cozy", label: "Cozy" },
  { v: "date-night", label: "Date night" },
  { v: "group-friendly", label: "Groups" },
  { v: "late-night", label: "Late night" },
  { v: "hidden-gem", label: "Hidden gems" },
  { v: "quick-bite", label: "Quick bite" },
  { v: "outdoor", label: "Outdoor" },
];

const DIETARY: { d: Dietary; label: string }[] = [
  { d: "vegetarian", label: "Vegetarian" },
  { d: "vegan", label: "Vegan" },
  { d: "gluten-free", label: "Gluten-free" },
  { d: "halal", label: "Halal" },
  { d: "dairy-free", label: "Dairy-free" },
];

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition active:scale-95 ${
        active
          ? "bg-olive text-paper ring-1 ring-olive"
          : "bg-paper-raised text-ink-soft ring-1 ring-line hover:bg-line/40"
      }`}
    >
      {children}
    </button>
  );
}

export default function Onboarding() {
  const router = useRouter();
  const complete = useStore((s) => s.completeOnboarding);
  const [step, setStep] = useState(0);
  const [p, setP] = useState<TasteProfile>(DEFAULT_PROFILE);

  const toggle = <T,>(key: keyof TasteProfile, value: T) =>
    setP((prev) => {
      const arr = prev[key] as unknown as T[];
      const next = arr.includes(value)
        ? arr.filter((x) => x !== value)
        : [...arr, value];
      return { ...prev, [key]: next } as TasteProfile;
    });

  const steps = [
    {
      title: "What do you crave?",
      subtitle: "Pick the cuisines you reach for most.",
      body: (
        <div className="flex flex-wrap gap-2">
          {ALL_CUISINES.map((c) => (
            <Chip
              key={c}
              active={p.cuisines.includes(c as Cuisine)}
              onClick={() => toggle<Cuisine>("cuisines", c as Cuisine)}
            >
              {c}
            </Chip>
          ))}
        </div>
      ),
    },
    {
      title: "What's the vibe?",
      subtitle: "We'll surface places that match your mood.",
      body: (
        <div className="flex flex-wrap gap-2">
          {VIBES.map(({ v, label }) => (
            <Chip
              key={v}
              active={p.vibes.includes(v)}
              onClick={() => toggle<Vibe>("vibes", v)}
            >
              {label}
            </Chip>
          ))}
        </div>
      ),
    },
    {
      title: "Any dietary needs?",
      subtitle: "Optional — we'll prioritize places that fit.",
      body: (
        <div className="flex flex-wrap gap-2">
          {DIETARY.map(({ d, label }) => (
            <Chip
              key={d}
              active={p.dietary.includes(d)}
              onClick={() => toggle<Dietary>("dietary", d)}
            >
              {label}
            </Chip>
          ))}
        </div>
      ),
    },
    {
      title: "A couple of dials",
      subtitle: "Fine-tune your recommendations.",
      body: (
        <div className="space-y-7">
          <div>
            <div className="mb-2 flex justify-between text-sm">
              <span className="font-semibold">Hidden gems vs. hotspots</span>
              <span className="text-ink-soft">
                {p.undergroundBias < 0.34
                  ? "Crowd favorites"
                  : p.undergroundBias < 0.7
                    ? "A mix"
                    : "Underground only"}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={p.undergroundBias * 100}
              onChange={(e) =>
                setP({ ...p, undergroundBias: Number(e.target.value) / 100 })
              }
              className="w-full accent-olive"
            />
            <p className="mt-1 text-xs text-ink-faint">
              How hard should we dig for spots the crowds haven&apos;t found yet?
            </p>
          </div>
          <div>
            <div className="mb-2 flex justify-between text-sm">
              <span className="font-semibold">Spice tolerance</span>
              <span className="text-ink-soft">
                {["Mild", "Medium", "Hot", "Inferno"][p.spiceTolerance]}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={3}
              value={p.spiceTolerance}
              onChange={(e) =>
                setP({ ...p, spiceTolerance: Number(e.target.value) })
              }
              className="w-full accent-olive"
            />
          </div>
          <div>
            <div className="mb-2 flex justify-between text-sm">
              <span className="font-semibold">Adventurousness</span>
              <span className="text-ink-soft">
                {p.adventurousness < 0.34
                  ? "Comfort zone"
                  : p.adventurousness < 0.67
                    ? "Open-minded"
                    : "Try anything"}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={p.adventurousness * 100}
              onChange={(e) =>
                setP({ ...p, adventurousness: Number(e.target.value) / 100 })
              }
              className="w-full accent-olive"
            />
          </div>
          <div>
            <div className="mb-2 text-sm font-semibold">Price comfort</div>
            <div className="flex gap-2">
              {([1, 2, 3, 4] as Price[]).map((pr) => (
                <Chip
                  key={pr}
                  active={p.price.includes(pr)}
                  onClick={() => toggle<Price>("price", pr)}
                >
                  {"$".repeat(pr)}
                </Chip>
              ))}
            </div>
          </div>
        </div>
      ),
    },
  ];

  const isLast = step === steps.length - 1;
  const cur = steps[step];

  const finish = (skipped: boolean) => {
    track("onboarding_complete", {
      skipped,
      cuisines: p.cuisines.length,
      vibes: p.vibes.length,
      undergroundBias: p.undergroundBias,
    });
    complete(p);
    router.replace("/feed");
  };

  return (
    <div className="phone-shell flex flex-col">
      <div className="flex-1 overflow-y-auto px-6 pt-10">
        {step === 0 && (
          <div className="mb-8 animate-floatUp">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/mascot-transparent.png"
              alt=""
              width={96}
              height={96}
              className="mb-3 h-24 w-24 select-none"
              draggable={false}
            />
            <div className="font-display text-3xl font-semibold tracking-tight">
              Truffle<span className="text-olive">.</span>
            </div>
            <p className="mt-1 text-sm text-ink-soft">
              Find the underground spots before everyone else — ranked for your
              taste.
            </p>
          </div>
        )}

        <div className="mb-5 flex gap-1.5">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full ${
                i <= step ? "bg-olive" : "bg-line"
              }`}
            />
          ))}
        </div>

        <h1 className="text-2xl font-semibold">{cur.title}</h1>
        <p className="mt-1 text-sm text-ink-soft">{cur.subtitle}</p>
        <div className="mt-6">{cur.body}</div>
      </div>

      <div className="border-t border-line p-4">
        <div className="flex items-center gap-3">
          {step > 0 && (
            <button
              onClick={() => setStep(step - 1)}
              className="rounded-full px-4 py-3 text-sm font-semibold text-ink-soft"
            >
              Back
            </button>
          )}
          <button
            onClick={() => {
              if (isLast) finish(false);
              else setStep(step + 1);
            }}
            className="flex-1 rounded-full bg-olive py-3.5 text-center text-sm font-bold text-paper transition active:scale-[0.98]"
          >
            {isLast ? "Start exploring" : "Continue"}
          </button>
        </div>
        {!isLast && step === 0 && (
          <button
            onClick={() => finish(true)}
            className="mt-2 w-full text-center text-xs text-ink-faint"
          >
            Skip for now
          </button>
        )}
      </div>
    </div>
  );
}
