# promo-cutouts (isolated pipeline)

Background-removes RB Store promo images and hosts the transparent cutouts in a
Supabase storage bucket (`promo-cutouts`, public), then sets `promos.image_cutout`.
The client prefers the cutout — the product floats on the dark theme (no white card)
— and because the Telegram `telesco.pe` image URLs **expire**, the stored cutout is
also the permanent copy.

## Why a separate package

`@imgly/background-removal-node` pulls in transitively-vulnerable deps (lodash, zod).
This dir has its **own** `package.json` / `node_modules` so those never reach the
app's bundle or `npm audit`. Its `node_modules` is gitignored.

## Run

```sh
cd scripts/promo-cutouts
npm ci                    # or: npm install
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node index.mjs
```

- `MAX` (default 25) caps cutouts per run.
- Idempotent: only cuts deals whose `image_cutout` is still null. `set_promos`
  preserves cutouts across a feed refresh (matched by link), so a persisting deal is
  cut once. Runs in the `Update promos` workflow right after `telegram-pull`.

## First-time setup

- The bucket is auto-created (public) on first run.
- Requires the `image_cutout` column — migration
  `supabase/migrations/20260707120000_promos_image_cutout.sql`.
