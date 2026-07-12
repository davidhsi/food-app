# 2026-07-11 — Rename: Truffle → Anaba

Status: Shipped

## Problem

While buying a custom domain for GTM, we found **"Truffle: Restaurant Tracker"**
(Reeltalk INC) — on the App Store since **March 2021**, actively maintained
(v12.0 Dec 2025), subscription-monetized, ~333 ratings, owning
`thetruffleapp.com` and the Google Play developer name "TruffleApp". Its product
is our category: track restaurants, want-to-try lists, personal map, friends'
recommendations over public reviews. Same name + same category + five years of
seniority = common-law trademark exposure and guaranteed App Store confusion,
surfacing at the worst moment (our launch or a future store submission). With
zero users and zero brand equity, a rename was at its cheapest — the
launch-readiness review's "no users yet" finding made this a find-and-replace,
not a migration.

## Decision

**Anaba** (穴場) — the Japanese word for "a great spot only the locals know."
The name *is* the product thesis, carries Japanese food-culture credibility,
is five spellable letters, and vetting found the cleanest collision profile of
~20 candidates across two rounds (English-idiom + cross-language):

- App Store: no food/discovery app named Anaba (only a dormant productivity
  app; a tiny "Hidden Japan: The Anaba Map" travel app confirms the meaning).
- Web: no restaurant product uses the name.
- Domains: `anaba.app`, `eatanaba.com`, `anaba.place` available at decision
  time (`anaba.com` taken).

## Alternatives rejected

- **Keep "Truffle" and coexist** — C&D risk that forces the expensive rename
  later; App Store search would land users on the incumbent.
- **Haunts** ("my old haunts") — best English idiom; Halloween SEO pollution
  and a haunted-places travel app owns `haunts.com`. Runner-up.
- **Sous** (French "under", sous-chef familiarity) — three existing "Sous"
  cooking apps in Food & Drink; most contested word of the finalists.
- **Sotto** (the concept seed: sotto voce) — loved the meaning; every short
  domain taken and existing Sotto restaurants add trademark texture. The
  cross-language search that produced Anaba started from Sotto.
- **Tucked / Alcove / Cachette / Secreto / Bijou / Bajito / Sub Rosa / Tacit /
  Morsel / Trove / Curio / Unearth / Dogear / Regulars** — dropped for
  collisions (Morsel, Trove, Curio, Sub Rosa, Tacit, Dogear), weak domains
  (Tucked, Alcove), spelling friction (Cachette, Bijou), genericness (Secreto),
  or voice mismatch (Bajito).

## Mechanics of the rename

All user-facing strings, `SITE_NAME`, manifest/PWA identity, OG images,
concierge + order-guide system prompts, `package.json`, profile monogram, and
the localStorage key (`truffle-store` → `anaba-store`; pre-rename local state
resets — acceptable at zero users). **Historical docs, specs, and decision
records keep "Truffle"** — they are records, not surfaces. The truffle-mushroom
app icon survives short-term (reads as "hidden thing sprouting"); a proper
Anaba mark is a follow-up.

## Caveat

Vetting = App Store + web + domains, not formal trademark clearance. A USPTO
search (and eventually a filing) is on the founder before spending on the brand.
