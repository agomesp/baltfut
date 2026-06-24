# Spike: sourcing player "craque" cutouts for the AO VIVO hero

**Status:** spike complete · mechanism shipped behind an off-by-default flag ·
**redesign is not blocked** (ships flags-only until this is turned on).
**Date:** 2026-06-24.

The redesigned hero scoreboard wants, per team, a transparent **craque** (star
player) cutout PNG and a grayscale **squad-wall**. Today we only have flag SVGs
(`public/flags/*.svg`). This documents how to source player cutouts, the
licensing reality, and the minimal mechanism wired in this branch.

---

## 1. FUTBIN: URL/ID pattern, signature, hotlink stability

Example (Bellingham): page `futbin.com/26/player/25796/jude-bellingham`, image
`https://cdn3.futbin.com/content/fifa26/img/players/p100915667.png?fm=png&ixlib=java-2.1.0&verzion=1&w=485&s=29d8…`

| Param | Meaning |
|---|---|
| `…/fifa26/…` | FIFA/FC edition — bumps every year, so IDs are edition-scoped. |
| `p100915667.png` | EA player **asset id** (stable per edition). Distinct from FUTBIN's own page id `25796`. |
| `w=485` | imgix render width. |
| `ixlib=java-2.1.0` | imgix Java SDK marker — the CDN is **imgix** behind Cloudflare. |
| `s=29d8…` | **imgix secure-URL signature** = `md5(secret + path + query)`. |

**Probed live (`curl`, 2026-06-24):**

| Test | Result | Conclusion |
|---|---|---|
| Full URL, default UA, **no referer** | `200`, 228 KB PNG | Hotlink works today; no referer check. |
| Browser UA + `futbin.com` referer | `200` (identical) | No UA/referer gating currently. |
| **Drop `&s=`** | `403` | Signature is **mandatory**. |
| **`w=485`→`w=300`, keep old `s=`** | `403` | Signature is **param-locked** to that exact URL. |
| Tampered `s=deadbeef…` | `403` | Signature is validated, not decorative. |
| Response headers | `server: cloudflare`, `cache-control: public, max-age=2678400` (31d), **`access-control-allow-origin: *`** | Browser `<img>` can load it cross-origin. |

**So:**

- **There is no public search/resolve API.** Name → id is a **manual** lookup
  (open the player page, right-click the render, copy the URL). FUTBIN's own
  site (`www.futbin.com`) is Cloudflare-bot-walled — automated `name → id`
  resolution would mean scraping behind a challenge, which is brittle **and**
  against their ToS. Don't build a scraper.
- **The `s=` signature does not expire on a timer** (no `exp` param) — but it is
  **locked to the exact query string** (you can only use the size it was minted
  for) and is **revocable** anytime FUTBIN rotates the imgix secret or toggles
  Cloudflare hotlink/referer protection (a one-switch change). A copied URL is
  "works today, no guarantees tomorrow."

**Verdict on hotlinking:** technically functional right now, operationally
fragile. Not something to hardcode into a shipped build.

## 2. Licensing / ToS

- FUTBIN is owned/operated by **Better Collective A/S** (Danish, publicly
  listed). ToS (`futbin.com/tos`, last updated 2026-02-24) is itself
  Cloudflare-walled to automated fetches; their standard terms restrict
  automated access, reproduction, and redistribution of site content.
- **The images are EA Sports IP.** FUTBIN hosts the FC player renders as a fan
  database; it **cannot grant us rights** to EA's artwork. Self-hosting removes
  the *technical* fragility but **does not cure the copyright** — it just moves
  the same EA/FUTBIN asset onto our origin.
- For a non-commercial fan project the practical enforcement risk is low, but
  it is **not "clean."** The license-clean paths are CC-licensed photos
  (Wikimedia Commons, CC-BY) background-removed into cutouts, or official
  federation/press imagery with permission — neither is a ready-made transparent
  cutout, so it means producing the cutouts ourselves.

**Recommendation:** do **not** hotlink FUTBIN (ToS + fragility). If we use FUTBIN
renders at all, **self-host a small curated set** under `public/players/` (mirrors
the self-hosted Kick-emote fallbacks in `public/reactions/`) and treat them as
placeholders to be replaced with license-checked art before this is enabled in
production. Keep the whole feature behind a flag (done — see §3).

## 3. The mechanism shipped in this branch (flag-gated)

A small typed map + resolver + a hero layer, all **off by default**.

- **Map — [`src/data/craques.ts`](../src/data/craques.ts):** `Record<FIFAcode,
  {name, img}[]>`. Seeded for ENG / FRA / BRA / ARG. `img` is a path under
  `public/players/`.
- **Resolver — [`src/lib/player-images.ts`](../src/lib/player-images.ts):**
  `craqueFor(code)` (first seeded entry, else `null`), `squadFor(code)`,
  `playerCutoutSrc(img, basePath)` (basePath-aware, like the flags), and the flag
  `PLAYER_CUTOUTS_ENABLED = process.env.NEXT_PUBLIC_PLAYER_CUTOUTS === "1"`.
  Unit-tested in `player-images.test.ts`.
- **Hero — [`src/components/live-view.tsx`](../src/components/live-view.tsx)
  (`HeroFx` / `CraqueCutout`):** when the flag is on **and** the followed team has
  a craque, a cutout is layered over the flag crest; otherwise nothing changes.
  A missing/failed PNG `onError`-hides itself, so the **flag crest is the
  fallback** — exactly the redesign's "flags when no player image" rule.

**Demo it:** `NEXT_PUBLIC_PLAYER_CUTOUTS=1 npm run dev`, follow **England**, open a
match where ENG plays → the (placeholder) cutout appears bottom-right over the
flag. Follow FRA/BRA/ARG (no committed image yet) → cutout silently absent, flag
shows. Default build (flag unset) is byte-for-byte the current flags-only hero.

### Add a player (manual process)

1. Find the render. FUTBIN: open the player page, right-click the image, copy URL.
   (Or use any license-checked transparent PNG.)
2. Self-host it:
   `scripts/players/fetch-cutout.sh '<url>' bra/vinicius.png`
   → writes `public/players/bra/vinicius.png`. (Local only; not in CI.)
3. Register it: add `{ name: "Vinícius Júnior", img: "bra/vinicius.png" }` under
   `BRA` in `src/data/craques.ts`.

The committed `public/players/eng/bellingham.png` is a **generated placeholder
silhouette** (`scripts/players/make-placeholder.py`) — no likeness, no
third-party art — so the path is wired and demoable without publishing EA/FUTBIN
imagery. Swap in a real, license-checked cutout to replace it.

## 4. Grayscale squad-wall (lower priority — not built)

Same sourcing problem, and cutouts are overkill here: a wall of **10 grayscale
photos per side** doesn't need transparency. Cleaner sourcing:

- **Wikimedia Commons** headshots (many national-team players are CC-BY/CC-BY-SA)
  → desaturate in CSS (`filter: grayscale(1)`); grayscale also hides
  lighting/source inconsistency, so a mixed set still looks cohesive.
- Reuse the **same `public/players/<code>/` convention**; extend `craques.ts`
  with a `wall: string[]` per team when we build it.
- Defer until the cutout sourcing decision (below) is made — the wall inherits
  whatever licensing posture we pick.

## Decision needed (not blocking)

The mechanism is shipped and safe (off by default, placeholder art). Before
enabling `PLAYER_CUTOUTS` in production, pick the image source:

- **A — self-host FUTBIN renders** (curated, ~1 craque/team). Fast, looks great,
  carries the EA/FUTBIN IP caveat above. Fine for a non-commercial fan site at
  the owner's discretion.
- **B — license-clean** (CC-BY Wikimedia photos, self-background-removed, or
  permissioned press art). Slower, heavier per player, but clean to publish.

Until then the redesign ships flags-only, exactly as today.
