# Ayende Autos - Favorites/Watchers + em-dash cleanup

Two things in one batch: **favorites = watchers** (heart a vehicle, get in-app
price/FX/sold change notices) and a repo-wide **em-dash -> hyphen** cleanup.

## 1. Files

```
NEW   apps/web/lib/favorites.ts                       toggle + saved-ids + read-time watch diff
NEW   apps/web/components/FavoriteHeart.tsx           the heart toggle (gallery card + detail)
NEW   apps/web/components/WatchingSection.tsx         self-fetching "Watching" list for My activity
NEW   apps/web/app/api/favorites/route.ts             POST toggle, GET state
NEW   apps/web/app/api/favorites/watching/route.ts    GET the watch-diff feed
EDIT  apps/api/prisma/schema.prisma                   Favorite.snapshot Json? (the only migration)
EDIT  apps/web/lib/types.ts                           WatchingItemView
EDIT  apps/web/components/VehicleCard.tsx             heart overlay on the card
EDIT  apps/web/components/GalleryGrid.tsx             threads favoritedIds -> cards
EDIT  apps/web/app/(shop)/gallery/page.tsx            fetches the user's saved ids
EDIT  apps/web/components/VehicleDetail.tsx           heart overlay on the detail photo
EDIT  apps/web/app/(shop)/vehicles/[id]/page.tsx      fetches favorited state
EDIT  apps/web/components/MyActivity.tsx              renders <WatchingSection/>
NEW   emdash-clean.ps1                                repo-wide em-dash -> hyphen
```

## 2. Run order (matters)

```powershell
# 1) extract THIS batch first
Expand-Archive -Force "$HOME\Downloads\ayende-watchers-emdash.zip" -DestinationPath C:\Dev\carbridge

cd C:\Dev\carbridge
# 2) clean em-dashes across the repo (after extract, so it cleans new files too)
powershell -ExecutionPolicy Bypass -File .\emdash-clean.ps1
# 3) migrate Neon (one nullable column) + build
pnpm -F "@carbridge/api" exec prisma migrate dev --name add_favorite_snapshot
pnpm -F "@carbridge/web" build
```
Commit the new `apps/api/prisma/migrations/...` folder with the code (Vercel runs
`prisma generate` against the already-migrated Neon).

No new env. Favorites are available to any signed-in user (a Registered perk).

## 3. How it works

- **Heart = save + watch.** Tapping it writes a `Favorite` and snapshots the
  vehicle's figures (landed total NGN/CAD, FX rate, CAD price, status) at that moment.
- **Watching list** (in My activity) recomputes each saved vehicle live and diffs
  vs the snapshot, surfacing **Price dropped $X / Price up $X / FX moved / Sold /
  Still available**. All at read time - **no cron, no notification table**, which
  is exactly why in-app-only fits.
- The card heart is filled from a single server-side id fetch (one query for the
  whole gallery). The detail modal's heart has no server prefill, so it self-syncs
  with one GET on mount.

## 4. Expected, not bugs

- A freshly-saved vehicle shows **"Still available"** with no change chips - there's
  nothing to diff against until something moves after you saved it.
- **FX "moved"** only flags when the naira total shifted >1% since you saved AND the
  CAD price itself didn't change (so a price edit reads as a price change, not FX).
- Guests (Clerk, no session) get a "Sign in to save" hint on the heart; in dev-bypass
  the seeded user resolves so it just works.

## 5. Em-dash cleanup

`emdash-clean.ps1` swaps `U+2014` -> `-` in every `.ts/.tsx` (skips
node_modules/.next/dist/.git). Prose em-dashes already carry spaces, so they read
as " - "; en-dashes (range "1-5 wk") and arrows are untouched. Idempotent - safe to
re-run. The files in THIS zip already ship hyphen-clean; the script catches the rest
(e.g. the email subjects in `templates.ts`).
