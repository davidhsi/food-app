# Truffle Redesign & Rebrand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand ReelEats → Truffle and replace the dark TikTok-style reels feed with a calm "Warm Editorial" experience (Garden palette, Fraunces + Inter, editorial list feed with progressive disclosure), reskinning every screen and adding a Share-a-spot card and a "Help me decide" pick.

**Architecture:** Presentation + information-architecture refactor. All business logic (`recommend.ts`, `ranking.ts`, `store.ts`, `gemScore`, static `data.ts`) stays intact. We introduce design tokens first, then a new `SpotCard` primitive and an editorial `Feed`, then reskin the shell/nav and each screen, then layer the two new features. The immersive video surface is retired; cards use the existing poster image. One card per restaurant (not per reel).

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Zustand, `next/font/google` (Fraunces, Inter). No new dependencies.

**Branch:** `truffle-redesign` (already created off `main`).

**Verification model:** No test runner is installed and the spec forbids new deps; this is a UI refactor. Each task is verified with `npm run typecheck`, `npm run build`, targeted `grep`, and a manual 375px visual check, then committed.

---

## Design Token Reference (used by every task)

When reskinning existing dark-theme classes, apply this mapping consistently:

| Old (dark) | New (Garden) |
|---|---|
| `bg-[#0c0c10]` / page bg | `bg-paper` |
| `bg-white/5`, `bg-white/8`, `bg-white/10` (surfaces) | `bg-paper-raised` |
| `bg-zinc-900` (sheets/modals) | `bg-paper-raised` |
| `text-white` (primary) | `text-ink` |
| `text-white/85`, `/80`, `/90` (body) | `text-ink` |
| `text-white/60`, `/65`, `/55`, `/50` (secondary) | `text-ink-soft` |
| `text-white/45`, `/40` (tertiary) | `text-ink-faint` |
| `text-brand`, `text-brand-glow` (accent) | `text-olive` |
| `bg-brand` (CTA) | `bg-olive text-paper` |
| `ring-white/10`, `/15`, `border-white/10` | `ring-line` / `border-line` |
| `font-black` / `font-extrabold` headings | `font-display font-semibold` |
| heading element fonts | add `font-display` |

Emoji-as-UI must be removed everywhere (see Task 3 for replacements). Emoji that are part of mock *content captions* in `data.ts` may stay (they're user-content, not UI chrome).

---

## Task 1: Design tokens (Tailwind + globals)

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Replace the theme `extend` block in `tailwind.config.ts`**

Keep `brand`/`ink` temporarily so un-reskinned screens still build; they're removed in Task 14.

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F4F1E8",
        "paper-raised": "#FBF9F2",
        ink: "#1d2014",
        "ink-soft": "#5f6450",
        "ink-faint": "#8c9072",
        olive: "#5c6b2e",
        "olive-deep": "#445223",
        line: "#d9d6c8",
        // legacy tokens — removed in Task 14 once no references remain
        brand: { DEFAULT: "#5c6b2e", dark: "#445223", glow: "#7a8b3f" },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      keyframes: {
        floatUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pop: {
          "0%": { transform: "scale(0.6)", opacity: "0" },
          "60%": { transform: "scale(1.15)", opacity: "1" },
          "100%": { transform: "scale(1)" },
        },
      },
      animation: {
        floatUp: "floatUp 0.5s ease-out both",
        pop: "pop 0.35s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
```

(Note: `brand.glow` is remapped to an olive tint so legacy `text-brand-glow` reads on-palette until reskinned. `kenburns` is removed.)

- [ ] **Step 2: Replace `src/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html,
body {
  background: #f4f1e8;
  color: #1d2014;
  -webkit-font-smoothing: antialiased;
  overscroll-behavior-y: none;
}

.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

/* phone frame for desktop viewing */
.phone-shell {
  width: 100%;
  max-width: 430px;
  height: 100dvh;
  margin: 0 auto;
  position: relative;
  overflow: hidden;
  background: #f4f1e8;
}

@media (min-width: 480px) {
  .phone-shell {
    height: min(900px, 100dvh);
    margin-top: max(0px, calc((100dvh - 900px) / 2));
    border-radius: 28px;
    box-shadow: 0 30px 80px rgba(40, 35, 20, 0.25), 0 0 0 1px rgba(40, 35, 20, 0.06);
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.001ms !important;
    transition-duration: 0.001ms !important;
  }
}
```

(Removed: dark `#0c0c10` defaults, `.snap-y-mandatory`/`.snap-start` no longer used by the feed, `.text-shadow` — none survive the redesign. `.no-scrollbar` stays for scroll regions.)

- [ ] **Step 3: Verify build**

Run: `npm run typecheck && npm run build`
Expected: PASS (some screens still reference `text-shadow`/`snap-*` utilities — if the build flags a missing class it won't error since they're plain strings; visual breakage on un-reskinned screens is expected and fixed in later tasks).

- [ ] **Step 4: Commit**

```bash
git add tailwind.config.ts src/app/globals.css
git commit -m "Add Garden design tokens; retire dark theme defaults"
```

---

## Task 2: Fonts + rebrand strings

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `package.json`
- Modify: `src/lib/store.ts:88`
- Modify: `README.md`

- [ ] **Step 1: Replace `src/app/layout.tsx`**

```tsx
import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600", "900"],
  variable: "--font-display",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Truffle — find the spots before everyone else",
  description:
    "A calm, editorial discovery app for under-the-radar restaurants. Find the hidden gems before they blow up.",
};

export const viewport: Viewport = {
  themeColor: "#f4f1e8",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Update `package.json` name + description**

Change the top fields:

```json
  "name": "truffle",
  "description": "Truffle — a calm, editorial discovery app for under-the-radar restaurants, built around a hidden-gem recommendation engine.",
```

- [ ] **Step 3: Update the persist key in `src/lib/store.ts`**

Change line 88 from `{ name: "reeleats-store" }` to:

```ts
    { name: "truffle-store" },
```

- [ ] **Step 4: Update README heading/first paragraph**

Replace any "ReelEats" occurrences with "Truffle" and update the one-line description to match the new positioning (calm editorial discovery, not a reels feed).

Run: `grep -ri "reeleats" README.md` → fix each.

- [ ] **Step 5: Verify**

Run: `npm run typecheck && npm run build`
Expected: PASS. Then `grep -ri "reeleats" src` → expect no matches.

- [ ] **Step 6: Commit**

```bash
git add src/app/layout.tsx package.json src/lib/store.ts README.md
git commit -m "Load Fraunces + Inter; rebrand ReelEats -> Truffle"
```

---

## Task 3: Icons (add glyphs, remove emoji reliance)

**Files:**
- Modify: `src/components/icons.tsx`

- [ ] **Step 1: Append new icons to `src/components/icons.tsx`** (before the final newline)

```tsx
export const GemIcon = (p: P) => (
  <svg {...base(p)} fill={p.filled ? "currentColor" : "none"}>
    <path d="M6 3h12l3 6-9 12L3 9z" />
    <path d="M3 9h18M9 3 6 9l6 12 6-12-3-6" />
  </svg>
);

export const ArrowRight = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export const XIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const ChevronDown = (p: P) => (
  <svg {...base(p)}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/icons.tsx
git commit -m "Add Gem, ArrowRight, X, ChevronDown icons"
```

---

## Task 4: `SpotCard` — the minimal editorial card

**Files:**
- Modify: `src/lib/feed.ts` (replace reel-expansion with one item per restaurant)
- Create: `src/components/SpotCard.tsx`

- [ ] **Step 1: Replace `src/lib/feed.ts`**

Editorial list shows one card per restaurant. Define the item type here (no longer derived from `ReelCard`).

```ts
import { RecommendationReason, Restaurant, ScoredRestaurant } from "./types";

export interface SpotItem {
  restaurant: Restaurant;
  /** 0..100 match score for the current taste profile. */
  matchScore: number;
  reasons: RecommendationReason[];
}

/** One editorial card per scored restaurant, in recommendation order. */
export function toSpotItems(scored: ScoredRestaurant[]): SpotItem[] {
  return scored.map((s) => ({
    restaurant: s.restaurant,
    matchScore: s.score,
    reasons: s.reasons,
  }));
}
```

- [ ] **Step 2: Create `src/components/SpotCard.tsx`**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { gemScore, Restaurant } from "@/lib/types";
import { useStore } from "@/lib/store";
import { BookmarkIcon } from "./icons";

const priceStr = (p: number) => "$".repeat(p);

export default function SpotCard({ restaurant: r }: { restaurant: Restaurant }) {
  const router = useRouter();
  const saved = useStore((s) => s.saved);
  const toggleSave = useStore((s) => s.toggleSave);
  const isSaved = saved.includes(r.id);
  const poster = r.reels[0]?.poster;
  const score = (gemScore(r) * 10).toFixed(1);

  return (
    <article className="mb-7 animate-floatUp">
      <button
        onClick={() => router.push(`/restaurant/${r.id}`)}
        className="block w-full text-left"
      >
        <div className="relative h-52 overflow-hidden rounded-[20px] bg-line">
          {poster && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={poster}
              alt={r.name}
              className="h-full w-full object-cover"
            />
          )}
          <div className="absolute left-3 top-3 rounded-full bg-ink/75 px-2.5 py-1 text-[11px] font-semibold text-paper backdrop-blur-sm">
            <span className="text-[#cfe08a]">◆</span> {score}
          </div>
        </div>
        <h3 className="mt-3 font-display text-2xl font-semibold leading-tight text-ink">
          {r.name}
        </h3>
        <div className="mt-1.5 text-[13px] text-ink-soft">
          <span className="font-semibold text-olive">★ {r.rating.toFixed(1)}</span>{" "}
          · {r.cuisines.join(" · ")} · {priceStr(r.price)} · {r.neighborhood}
        </div>
      </button>
      <button
        onClick={() => toggleSave(r.id)}
        aria-label={isSaved ? "Saved" : "Save to want to try"}
        className="absolute -mt-[208px] ml-[calc(100%-46px)] grid h-9 w-9 place-items-center rounded-full bg-paper-raised/90 text-ink backdrop-blur-sm active:scale-90 transition-transform"
      >
        <BookmarkIcon filled={isSaved} width={16} height={16} />
      </button>
    </article>
  );
}
```

(The save button is rendered after the link so it sits above it; the negative-margin overlay keeps it out of the link's tap target. If overlay math proves fragile during the visual pass, wrap the photo+save in a `relative` container instead — see Step 4.)

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm run build`
Expected: PASS (note: `ReelFeed.tsx`/`ReelCard.tsx` still import the old `FeedItem` and `toFeedItems` — those are replaced in Task 5; if the build errors on the missing `toFeedItems` export, that's expected and resolved by Task 5. To keep this task's build green, temporarily keep `toFeedItems` is NOT needed — proceed to Task 5 immediately as they are a pair.)

> Tasks 4 and 5 form one commit boundary if the build can't be green between them. Prefer running Task 5 before committing if `next build` fails here.

- [ ] **Step 4 (only if save-overlay looks wrong in the visual pass): use a relative wrapper instead**

Replace the `<button onClick={() => router.push...}>` + save button structure so the photo is wrapped in a `relative` div and the save button is `absolute right-2.5 top-2.5` inside it, with the name/meta as a separate sibling button. Re-verify build.

- [ ] **Step 5: Commit (with Task 5)**

```bash
git add src/lib/feed.ts src/components/SpotCard.tsx
git commit -m "Add SpotItem type and minimal editorial SpotCard"
```

---

## Task 5: Editorial `Feed` + feed page

**Files:**
- Create: `src/components/Feed.tsx`
- Modify: `src/app/feed/page.tsx`

- [ ] **Step 1: Create `src/components/Feed.tsx`**

```tsx
"use client";

import { Restaurant } from "@/lib/types";
import SpotCard from "./SpotCard";

export default function Feed({
  restaurants,
  emptyLabel = "Nothing to show yet.",
}: {
  restaurants: Restaurant[];
  emptyLabel?: string;
}) {
  if (restaurants.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center p-8 text-center text-ink-soft">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="px-4">
      {restaurants.map((r) => (
        <SpotCard key={r.id} restaurant={r} />
      ))}
      <p className="pb-6 pt-2 text-center text-[13px] text-ink-faint">
        You&apos;re all caught up — come back tomorrow for more gems.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Replace `src/app/feed/page.tsx`**

```tsx
"use client";

import { useMemo } from "react";
import AppShell from "@/components/AppShell";
import Feed from "@/components/Feed";
import HelpMeDecide from "@/components/HelpMeDecide";
import { useStore } from "@/lib/store";
import { recommend } from "@/lib/recommend";

export default function FeedPage() {
  const profile = useStore((s) => s.profile);
  const liked = useStore((s) => s.liked);
  const saved = useStore((s) => s.saved);
  const ranked = useStore((s) => s.ranked);
  const seen = useStore((s) => s.seen);

  const restaurants = useMemo(() => {
    const scored = recommend({ profile, liked, saved, ranked, seen });
    return scored.map((s) => s.restaurant);
  }, [profile, liked, saved, ranked, seen]);

  return (
    <AppShell>
      <div className="h-full overflow-y-auto pb-24">
        <header className="px-5 pb-3 pt-9">
          <div className="font-display text-2xl font-semibold tracking-tight text-ink">
            Truffle<span className="text-olive">.</span>
          </div>
          <p className="mt-0.5 text-[13px] text-ink-soft">
            Before everyone finds out
          </p>
        </header>
        <Feed restaurants={restaurants} />
        <HelpMeDecide />
      </div>
    </AppShell>
  );
}
```

(`HelpMeDecide` is created in Task 9. To keep the build green before then, comment out the `<HelpMeDecide />` line and its import, then re-enable in Task 9. The plan re-enables it explicitly in Task 9 Step 3.)

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm run build`
Expected: PASS (with `<HelpMeDecide />` temporarily commented out). Then `npm run dev`, open `http://localhost:3000/feed`, confirm: paper background, editorial cards, gem score badge, save toggles, tapping a card routes to detail, "caught up" footer shows.

- [ ] **Step 4: Commit**

```bash
git add src/components/Feed.tsx src/app/feed/page.tsx src/lib/feed.ts src/components/SpotCard.tsx
git commit -m "Replace reels feed with editorial list feed"
```

---

## Task 6: AppShell + BottomNav reskin

**Files:**
- Modify: `src/components/AppShell.tsx`
- Modify: `src/components/BottomNav.tsx`

- [ ] **Step 1: Update the loader block in `AppShell.tsx`**

Replace the `if (!hydrated)` return with the Garden wordmark:

```tsx
  if (!hydrated) {
    return (
      <div className="phone-shell flex items-center justify-center">
        <div className="animate-pulse font-display text-3xl font-semibold tracking-tight text-ink">
          Truffle<span className="text-olive">.</span>
        </div>
      </div>
    );
  }
```

- [ ] **Step 2: Replace the `<nav>` in `BottomNav.tsx`**

```tsx
    <nav className="absolute bottom-0 inset-x-0 z-30 border-t border-line bg-paper/90 backdrop-blur-xl">
      <div className="flex items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
        {tabs.map(({ href, label, Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 transition-colors ${
                active ? "text-olive" : "text-ink-faint"
              }`}
            >
              <Icon filled={active} width={23} height={23} />
              <span className="text-[10px] font-medium tracking-wide">
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
```

(The tab labels stay Feed / Search / AI / You. The `SparkleIcon` for the AI tab is fine.)

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm run build`. Then visually confirm nav is light/olive and the loader shows the Truffle wordmark.

- [ ] **Step 4: Commit**

```bash
git add src/components/AppShell.tsx src/components/BottomNav.tsx
git commit -m "Reskin app shell and bottom nav to Garden"
```

---

## Task 7: Restaurant detail (the tap-through depth surface)

**Files:**
- Modify: `src/app/restaurant/[id]/page.tsx`

- [ ] **Step 1: Replace `src/app/restaurant/[id]/page.tsx`**

This surface holds the depth cut from the card: hero, "why you" reasons (from `scoreRestaurant`), insider tip, derived earliness cue, and actions (Rank / Save / Share). Reuses the existing `RankModal` and the `ShareSpot` component (Task 8).

```tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getRestaurant } from "@/lib/data";
import { gemScore } from "@/lib/types";
import { useStore } from "@/lib/store";
import { scoreRestaurant } from "@/lib/recommend";
import RankModal from "@/components/RankModal";
import ShareSpot from "@/components/ShareSpot";
import {
  BookmarkIcon,
  ChevronLeft,
  HeartIcon,
  PinIcon,
  PlusIcon,
  StarIcon,
} from "@/components/icons";

export default function RestaurantPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const r = getRestaurant(params.id);
  const profile = useStore((s) => s.profile);
  const liked = useStore((s) => s.liked);
  const saved = useStore((s) => s.saved);
  const ranked = useStore((s) => s.ranked);
  const seen = useStore((s) => s.seen);
  const toggleLike = useStore((s) => s.toggleLike);
  const toggleSave = useStore((s) => s.toggleSave);
  const [ranking, setRanking] = useState(false);

  const scored = useMemo(
    () => (r ? scoreRestaurant(r, { profile, liked, saved, ranked, seen }) : null),
    [r, profile, liked, saved, ranked, seen],
  );

  if (!r) {
    return (
      <div className="phone-shell flex items-center justify-center text-ink-soft">
        Restaurant not found.
      </div>
    );
  }

  const isLiked = liked.includes(r.id);
  const isSaved = saved.includes(r.id);
  const myRank = ranked.find((e) => e.restaurantId === r.id);
  const poster = r.reels[0]?.poster;
  const undiscovered = Math.round((1 - r.buzz) * 100);
  const isGem = gemScore(r) >= 0.45;

  return (
    <div className="phone-shell overflow-y-auto bg-paper pb-10">
      {/* Hero */}
      <div className="relative h-[44%] min-h-[300px] bg-line">
        {poster && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={poster}
            alt={r.name}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink/85 to-transparent" />
        <button
          onClick={() => router.back()}
          aria-label="Back"
          className="absolute left-3 top-4 grid h-10 w-10 place-items-center rounded-full bg-paper-raised/90 text-ink backdrop-blur-sm"
        >
          <ChevronLeft width={22} height={22} />
        </button>
        <div className="absolute inset-x-0 bottom-0 p-5">
          <h1 className="font-display text-3xl font-semibold leading-tight text-paper">
            {r.name}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-paper/90">
            <span className="inline-flex items-center gap-1 font-semibold text-[#cfe08a]">
              <StarIcon filled width={15} height={15} /> {r.rating.toFixed(1)}
            </span>
            <span className="text-paper/50">·</span>
            <span>{r.cuisines.join(" · ")}</span>
            <span className="text-paper/50">·</span>
            <span>{"$".repeat(r.price)}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-paper/70">
            <PinIcon width={13} height={13} />
            {r.neighborhood}, {r.city} · {r.distanceKm} km away
          </div>
        </div>
      </div>

      {/* Earliness cue (derived from buzz; not a live count) */}
      {isGem && (
        <div className="mx-5 mt-4 rounded-2xl border border-line bg-paper-raised px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-olive">
            ◷ You&apos;d be early
          </div>
          <p className="mt-0.5 text-sm text-ink-soft">
            Still under the radar — only about {undiscovered}% of people have found it.
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 px-5 py-4">
        <button
          onClick={() => setRanking(true)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-olive py-3 text-sm font-semibold text-paper active:scale-95"
        >
          <PlusIcon width={18} height={18} />
          {myRank ? `Ranked ${myRank.score.toFixed(1)}` : "Rank it"}
        </button>
        <button
          onClick={() => toggleSave(r.id)}
          aria-label="Save"
          className={`grid h-12 w-12 place-items-center rounded-full ring-1 ring-line active:scale-95 ${
            isSaved ? "bg-olive/15 text-olive" : "bg-paper-raised text-ink"
          }`}
        >
          <BookmarkIcon filled={isSaved} width={20} height={20} />
        </button>
        <button
          onClick={() => toggleLike(r.id)}
          aria-label="Like"
          className={`grid h-12 w-12 place-items-center rounded-full ring-1 ring-line active:scale-95 ${
            isLiked ? "bg-olive/15 text-olive" : "bg-paper-raised text-ink"
          }`}
        >
          <HeartIcon filled={isLiked} width={20} height={20} />
        </button>
        <ShareSpot restaurant={r} />
      </div>

      {/* Why you */}
      {scored && scored.reasons.length > 0 && (
        <div className="px-5">
          <h2 className="text-sm font-semibold text-ink-faint">Why you&apos;ll like it</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {scored.reasons.map((why) => (
              <span
                key={why.label}
                className="rounded-full bg-paper-raised px-3 py-1.5 text-xs font-medium text-ink-soft ring-1 ring-line"
              >
                {why.label.replace(/\s*[🌶️💎]\s*/gu, "").trim()}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Insider tip */}
      {r.insiderTip && (
        <div className="mx-5 mt-5 rounded-2xl border border-line bg-paper-raised p-3.5">
          <div className="text-xs font-semibold uppercase tracking-wide text-olive">
            Order like a regular
          </div>
          <p className="mt-1 text-sm text-ink">{r.insiderTip}</p>
        </div>
      )}

      {/* About */}
      <div className="px-5 pt-5">
        <h2 className="text-sm font-semibold text-ink-faint">About</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ink">{r.blurb}</p>
      </div>

      {/* Signature dishes */}
      <div className="px-5 pt-5">
        <h2 className="text-sm font-semibold text-ink-faint">Signature dishes</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {r.signatureDishes.map((d) => (
            <span
              key={d}
              className="rounded-full bg-paper-raised px-3 py-1.5 text-xs font-medium text-ink ring-1 ring-line"
            >
              {d}
            </span>
          ))}
        </div>
      </div>

      {/* Known for */}
      <div className="px-5 pt-5">
        <h2 className="text-sm font-semibold text-ink-faint">Known for</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {[...r.tags, ...r.vibes.map((v) => v.replace("-", " "))].map((t) => (
            <span
              key={t}
              className="rounded-full bg-paper-raised px-3 py-1.5 text-xs text-ink-soft ring-1 ring-line"
            >
              #{t.replace(/\s+/g, "")}
            </span>
          ))}
        </div>
      </div>

      {ranking && <RankModal restaurant={r} onClose={() => setRanking(false)} />}
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck && npm run build` (will error on missing `ShareSpot` until Task 8 — run Task 8 before committing, or temporarily stub the import/usage). Then visually confirm the detail page: light hero with gradient, earliness card, why-you chips (no emoji), insider tip, about/dishes/known-for.

- [ ] **Step 3: Commit (with Task 8)**

```bash
git add "src/app/restaurant/[id]/page.tsx"
git commit -m "Reskin restaurant detail; add why-you + earliness + insider depth"
```

---

## Task 8: Share-a-spot card

**Files:**
- Create: `src/components/ShareSpot.tsx`

- [ ] **Step 1: Create `src/components/ShareSpot.tsx`**

```tsx
"use client";

import { Restaurant } from "@/lib/types";
import { ShareIcon } from "./icons";

export default function ShareSpot({ restaurant: r }: { restaurant: Restaurant }) {
  const share = () => {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/restaurant/${r.id}`
        : "";
    const text = `${r.name} — ${r.cuisines.join(", ")} · ${r.neighborhood}. A hidden gem I found on Truffle.`;
    if (typeof navigator !== "undefined" && navigator.share) {
      navigator.share({ title: r.name, text, url }).catch(() => {});
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(`${text} ${url}`).catch(() => {});
    }
  };

  return (
    <button
      onClick={share}
      aria-label={`Share ${r.name}`}
      className="grid h-12 w-12 place-items-center rounded-full bg-paper-raised text-ink ring-1 ring-line active:scale-95"
    >
      <ShareIcon width={20} height={20} />
    </button>
  );
}
```

(v1 shares a rich link + caption via the Web Share API, clipboard fallback. Image export of a styled card is a deferred enhancement per the spec.)

- [ ] **Step 2: Verify**

Run: `npm run typecheck && npm run build`
Expected: PASS (the detail page from Task 7 now resolves `ShareSpot`).

- [ ] **Step 3: Commit**

```bash
git add src/components/ShareSpot.tsx
git commit -m "Add Share-a-spot action (Web Share + clipboard fallback)"
```

---

## Task 9: "Help me decide"

**Files:**
- Create: `src/components/HelpMeDecide.tsx`
- Modify: `src/app/feed/page.tsx` (re-enable the import + element)

- [ ] **Step 1: Create `src/components/HelpMeDecide.tsx`**

One confident pick from the top of the recommendation list, with its reason. No spinner, no variable reward.

```tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { recommend } from "@/lib/recommend";
import { SparkleIcon, ArrowRight } from "./icons";

export default function HelpMeDecide() {
  const router = useRouter();
  const profile = useStore((s) => s.profile);
  const liked = useStore((s) => s.liked);
  const saved = useStore((s) => s.saved);
  const ranked = useStore((s) => s.ranked);
  const seen = useStore((s) => s.seen);
  const [open, setOpen] = useState(false);

  // Top candidates; the pick rotates by how many times the user asks.
  const [askCount, setAskCount] = useState(0);
  const pick = useMemo(() => {
    const scored = recommend({ profile, liked, saved, ranked, seen });
    const top = scored.slice(0, 5);
    return top.length ? top[askCount % top.length] : null;
  }, [profile, liked, saved, ranked, seen, askCount]);

  if (!pick) return null;

  return (
    <div className="px-5 pb-8 pt-2">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-olive py-3 text-sm font-semibold text-paper active:scale-[0.98]"
        >
          <SparkleIcon width={17} height={17} /> Can&apos;t decide? Truffle picks tonight
        </button>
      ) : (
        <div className="rounded-2xl border border-line bg-paper-raised p-4 animate-floatUp">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-olive">
            Tonight, go to
          </div>
          <h3 className="mt-1 font-display text-2xl font-semibold text-ink">
            {pick.restaurant.name}
          </h3>
          <div className="mt-1 text-[13px] text-ink-soft">
            {pick.restaurant.cuisines.join(" · ")} · {pick.restaurant.neighborhood}
          </div>
          {pick.reasons[0] && (
            <p className="mt-2 text-sm text-ink">
              Why: {pick.reasons[0].label.replace(/\s*[🌶️💎]\s*/gu, "").trim()}.
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => router.push(`/restaurant/${pick.restaurant.id}`)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-olive py-2.5 text-sm font-semibold text-paper active:scale-95"
            >
              See it <ArrowRight width={16} height={16} />
            </button>
            <button
              onClick={() => setAskCount((n) => n + 1)}
              className="rounded-full bg-paper px-4 py-2.5 text-sm font-medium text-ink-soft ring-1 ring-line active:scale-95"
            >
              Pick again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify the component**

Run: `npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 3: Re-enable `<HelpMeDecide />` in `src/app/feed/page.tsx`**

Ensure the import `import HelpMeDecide from "@/components/HelpMeDecide";` is present and the `<HelpMeDecide />` element renders after `<Feed ... />` (uncomment if it was commented in Task 5).

- [ ] **Step 4: Verify end-to-end**

Run: `npm run build`, then `npm run dev`. On `/feed`, click "Can't decide?" → one pick with a reason appears; "Pick again" rotates; "See it" routes to detail. No spinner.

- [ ] **Step 5: Commit**

```bash
git add src/components/HelpMeDecide.tsx src/app/feed/page.tsx
git commit -m "Add deterministic 'Help me decide' pick"
```

---

## Task 10: Search reskin

**Files:**
- Modify: `src/app/search/page.tsx`

- [ ] **Step 1: Read the full file, then apply changes**

Run: `cat src/app/search/page.tsx` to see the current markup.

Apply, using the Design Token Reference table:
1. Render results with the new `SpotCard`: import `SpotCard from "@/components/SpotCard"` and map results to `<SpotCard key={r.id} restaurant={r} />` inside a `px-4` container (replacing the old `ReelFeed`/`toFeedItems` usage). Remove imports of `ReelFeed` and `toFeedItems`.
2. Reskin the search input, trending chips, and headings per the token table (`bg-paper-raised`, `text-ink`, `ring-line`, accent `olive`, headings `font-display`).
3. Remove any emoji from the `TRENDING` strings only if they are decorative; the listed queries (`"hidden gems"`, etc.) have none — leave copy as-is.
4. Wordmark/title uses `font-display`.

- [ ] **Step 2: Verify**

Run: `npm run typecheck && npm run build`. Visually: search input + chips are Garden; submitting a query shows `SpotCard` results; tapping routes to detail.

- [ ] **Step 3: Commit**

```bash
git add src/app/search/page.tsx
git commit -m "Reskin Search to Garden; render results as SpotCard"
```

---

## Task 11: Assistant (AI) reskin

**Files:**
- Modify: `src/app/assistant/page.tsx`

- [ ] **Step 1: Read the full file**

Run: `cat src/app/assistant/page.tsx`.

Apply, using the token table:
1. Reskin chat bubbles: user bubble `bg-olive text-paper`, assistant bubble `bg-paper-raised text-ink ring-1 ring-line`.
2. Suggestion chips, input bar, and send button → Garden tokens; send button `bg-olive text-paper`.
3. Any restaurant results rendered in the thread → render with `SpotCard` (import it) or a compact link styled with tokens; remove the old emoji/`StarIcon` brand styling and use `text-olive`.
4. Headings/wordmark → `font-display`. Remove decorative emoji from UI; keep `SparkleIcon`.

- [ ] **Step 2: Verify**

Run: `npm run typecheck && npm run build`. Visually: chat is Garden, suggestions and input on-palette, results route to detail, `/api/assistant` still responds.

- [ ] **Step 3: Commit**

```bash
git add src/app/assistant/page.tsx
git commit -m "Reskin AI assistant to Garden"
```

---

## Task 12: Profile ("You") reskin

**Files:**
- Modify: `src/app/profile/page.tsx`

- [ ] **Step 1: Read the full file**

Run: `cat src/app/profile/page.tsx`.

Apply, using the token table:
1. Replace the `🍴` avatar with an SVG monogram: a `rounded-full bg-olive text-paper` circle containing a `font-display` "T".
2. Header gradient `from-brand/30` → `from-olive/20`; taste chips → `bg-paper-raised text-ink-soft ring-line`.
3. The `scoreColor` helper currently returns dark-theme greens/limes — replace with on-palette values: `>=8.5` `text-olive`, `>=7` `text-olive-deep`, `>=5.5` `text-ink-soft`, else `text-ink-faint`.
4. been/want tabs, list rows → Garden tokens; headings `font-display`. Remove decorative emoji.

- [ ] **Step 2: Verify**

Run: `npm run typecheck && npm run build`. Visually: profile header, monogram avatar, tabs, and ranked/saved lists are Garden; ranking scores readable.

- [ ] **Step 3: Commit**

```bash
git add src/app/profile/page.tsx
git commit -m "Reskin Profile to Garden; replace emoji avatar with monogram"
```

---

## Task 13: Onboarding reskin

**Files:**
- Modify: `src/app/onboarding/page.tsx`

- [ ] **Step 1: Reskin the `Chip` component**

Replace the `Chip` button classes:

```tsx
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
```

- [ ] **Step 2: Reskin the rest using the token table**

1. Wordmark: `Truffle<span className="text-olive">.</span>` in `font-display`.
2. Progress bars: active `bg-olive`, inactive `bg-line`.
3. Headings `font-display`; subtitles `text-ink-soft`; helper text `text-ink-faint`.
4. Range inputs: `accent-olive` (replace `accent-brand`).
5. Remove the `💎` from the "Underground only 💎" label → "Underground only".
6. Continue/Start button: `bg-olive text-paper` (replace `bg-brand ... shadow-brand/30` — drop the colored shadow).
7. Footer border `border-line`.

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm run build`. Visually walk all onboarding steps at 375px; confirm chips, sliders, buttons are Garden and no emoji remain.

- [ ] **Step 4: Commit**

```bash
git add src/app/onboarding/page.tsx
git commit -m "Reskin onboarding to Garden"
```

---

## Task 14: Reskin RankModal, remove dead code, final sweep

**Files:**
- Modify: `src/components/RankModal.tsx`
- Delete: `src/components/ReelCard.tsx`, `src/components/ReelFeed.tsx`, `src/components/ActionRail.tsx`
- Modify: `tailwind.config.ts` (remove legacy `brand`)

- [ ] **Step 1: Reskin `RankModal.tsx`**

Using the token table: overlay `bg-ink/60`; sheet `bg-paper-raised border-t border-line`; the drag handle `bg-line`; bucket buttons `bg-paper text-ink ring-1 ring-line`; "How was X" accent `text-olive`; comparison option cards `bg-paper ring-1 ring-line`. Replace the emoji-driven bits:
- Bucket buttons: drop the `😍 🙂 😐` emoji; use text labels only ("Loved it" / "It was OK" / "Not great") with `font-display` and a small `text-olive` dot, OR keep the three buttons text-only.
- Comparison cards: replace `opt.reels[0]?.emoji ?? "🍽️"` with a small thumbnail using `opt.reels[0]?.poster` in a `h-16 w-full rounded-lg object-cover` image (fallback `bg-line`). Replace the "New" tag `text-brand-glow` → `text-olive`.

- [ ] **Step 2: Confirm the old reel components are unreferenced, then delete**

Run: `grep -rn "ReelCard\|ReelFeed\|ActionRail" src`
Expected: only the files themselves match (no importers — `feed/page.tsx`, `search/page.tsx` were migrated to `SpotCard`/`Feed`). If any importer remains, migrate it to `SpotCard`/`Feed` first.

Then:

```bash
git rm src/components/ReelCard.tsx src/components/ReelFeed.tsx src/components/ActionRail.tsx
```

- [ ] **Step 3: Remove the legacy `brand` token**

Run: `grep -rn "brand\b\|brand-glow\|brand-dark" src`
Expected: no matches. If any remain, fix them to `olive`/`olive-deep` per the token table. Then delete the `brand: { ... }` line from `tailwind.config.ts`.

- [ ] **Step 4: Full-app sweeps**

Run each and resolve any hits:
- `grep -rni "reeleats" src package.json README.md` → none.
- `grep -rn "kenburns\|text-shadow\|snap-y-mandatory\|snap-start" src` → none (or only intentional).
- `grep -rn "0c0c10\|bg-white/\|text-white/" src` → none in reskinned files (white-on-photo in the detail hero uses `text-paper`, which is fine).
- Emoji-as-UI audit: `grep -rnP "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]" src/components src/app` — remaining matches should only be inside `data.ts` content captions/gradients, not in component/page chrome.

- [ ] **Step 5: Final verification**

Run: `npm run typecheck && npm run build`
Expected: PASS, no warnings about missing modules.
Then `npm run dev` and walk the full flow at 375px: onboarding → feed → card → detail (rank, save, share) → help-me-decide → search → assistant → profile. Confirm reduced-motion (no kenburns), no emoji chrome, all-Garden palette.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Reskin RankModal; remove retired reel components and legacy brand token"
```

---

## Self-Review — spec coverage

- Rebrand strings/metadata/store key/README → Task 2. ✓
- Garden palette tokens → Task 1. ✓
- Fraunces + Inter via next/font → Task 2. ✓
- Remove emoji-as-UI; one icon family → Tasks 3, 7, 12, 13, 14 (+ audit in 14). ✓
- One surface treatment, no glass-soup, remove kenburns, reduced-motion → Tasks 1, and reskins. ✓
- Editorial list feed (one card per restaurant) + "you're caught up" → Tasks 4, 5. ✓
- Minimal SpotCard anatomy (photo · gem · name · one line · save) → Task 4. ✓
- Tap-through detail depth (why-you, insider tip, earliness cue, actions) → Task 7. ✓
- Earliness as derived cue, not live count → Task 7 (uses `1 - buzz`, copy hedged). ✓
- Share-a-spot card → Task 8. ✓
- "Help me decide" (no spinner) → Task 9. ✓
- Screen-by-screen reskin (onboarding, feed, search, AI, profile, detail) → Tasks 5,7,10,11,12,13. ✓
- Shell + bottom nav reskin → Task 6. ✓
- Retire reels video surface; keep data model → Tasks 4,5,14 (poster image used; types untouched). ✓
- Deferred (taste-trainer, focus reader, real receipts, dark mode, slot mechanic) → not built, by design. ✓
- Verification: typecheck + build + grep + visual → every task. ✓
```
