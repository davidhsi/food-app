# Truffle — deployment & hosting (operational truth)

The single source of truth for *where Truffle runs and how it ships*. Update this
when the live state changes (new env var, custom domain, project move).

## Where it runs

- **Host:** Vercel project **`food-app`** (team `hsidavid02-4050`), connected to
  GitHub `davidhsi/food-app` via Vercel's **Git integration**. The local link
  lives in `.vercel/` (gitignored — not shared).
- **Live (production) URL:** **https://food-app-ecru-ten.vercel.app** — the stable
  production alias. Also aliased as `food-app-git-main-…vercel.app`.
- **Custom domain:** none yet. (To add one: see below.)

## How it ships — auto-deploy is ON

Because the GitHub repo is connected, **deploys are automatic** — there is no
manual deploy step in the normal flow:

| You do | Vercel does |
|---|---|
| push / merge to **`main`** | builds + deploys to **Production** (the live URL) |
| push a branch / open a PR | builds a throwaway **Preview** deployment (its own URL) |

`main` **is** the production branch — there is no separate "dev" deployment from
`main`. Previews are the dev/staging surface.

- **Manual deploy (rarely needed):** `vercel --prod` (deploys local working tree)
  or `vercel redeploy <prod-url>` (rebuilds the last prod deploy with current
  settings — use this to pick up an env-var change without a code push).
- **Check status:** `vercel ls food-app` (recent deploys + Ready/Error state).

## Environment variables (Production)

Set in Vercel → Project → Settings → Environment Variables (not in git):

| Var | Required | Purpose | Notes |
|---|---|---|---|
| `GOOGLE_PLACES_API_KEY` | yes | `/api/photo` proxy + OG-image photo fetch | without it, cards/hero/OG render image-less |
| `NEXT_PUBLIC_SITE_URL` | yes (for correct share links) | canonical host for OG/metadata absolute URLs (`src/lib/site.ts`) | currently `https://food-app-ecru-ten.vercel.app`. **`NEXT_PUBLIC_*` is inlined at build time → you must redeploy after changing it**, not just save it. Falls back to per-deploy `VERCEL_URL` if unset (rotating URL — bad for shares). |
| `ANTHROPIC_API_KEY` | optional | Claude concierge + ordering upgrade | absent → deterministic local engine (feature still works) |

`vercel env ls production` shows what's set (values encrypted).

## Verifying a deploy is healthy

Against the live URL (or a preview URL):

```bash
BASE=https://food-app-ecru-ten.vercel.app
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/feed"                       # 200
ID=<a real restaurant id from restaurants.core.json>
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" \
  "$BASE/restaurant/$ID/opengraph-image"                                    # 200 image/png
curl -s "$BASE/restaurant/$ID" | grep -o 'og:image[^>]*'                    # absolute URL on $BASE, not a food-<hash> deploy URL
```

If `og:image` shows a rotating `food-<hash>-…vercel.app` host, `NEXT_PUBLIC_SITE_URL`
is unset/stale — set it and **redeploy** (build-time inlining).

## Adding a custom domain (when ready)

1. Vercel → Project → Settings → Domains → add the domain, follow DNS steps.
2. Update `NEXT_PUBLIC_SITE_URL` to the new domain (Production env).
3. **Redeploy** (e.g. `vercel redeploy <prod-url>` or push to `main`) so the new
   value is baked into the build.

## Not part of deploy

- **Data ingest** (`npm run ingest`) runs **locally**, never during build; commit
  the regenerated JSON. See `docs/superpowers/plans/2026-06-14-real-data-ingestion.md`.
- **Analytics / Speed Insights** need no config — they activate automatically on a
  Vercel deploy (the components are mounted in `layout.tsx`).
