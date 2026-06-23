# Spike — show Telegram promo-group items on the page (local notes)

**Question:** can we read the promo group's messages **without a bot**, using the
fact that I'm a **member** of the group?

**Short answer: YES.** Two no-bot routes, plus a manual one.

---

## ✅ CONFIRMED for `t.me/rbstorenet` (checked 2026-06-22)

It's a **PUBLIC CHANNEL** ("RB Store"), so **Route B works — zero auth, no bot, no
login, no userbot, no credentials at all**. `https://t.me/s/rbstorenet` returns
the last ~20 posts as server-rendered HTML, and they parse straight into promo
items, e.g.:
```json
{ "store": "Amazon", "product": "Placa Mãe Gigabyte B850 GAMING WIFI6 …",
  "link": "https://rbstore.net/s/bcbb10c2_th", "price": "R$ 1.299,00",
  "coupon": "…", "date": "2026-06-22T22:25:45+00:00" }
```
Each post = store emoji + name, `✅` product, `🔗 rbstore.net` link, `💲 R$` price,
`🏷 Cupom` code. `product`/`link`/`price`/`date` extract reliably; `store`/`coupon`
need a small regex tweak. **So Route A (userbot) is NOT needed for this channel.**

**One delivery caveat (CORS):** the browser can't fetch `t.me/s/…` directly from
the static page (Telegram sends no CORS header). So it needs one of:
- a **build/cron fetch → `public/promos.json`** (commit → Pages deploy → reloads
  the stream; do it off-stream), or
- a **tiny proxy/serverless endpoint** the page fetches at runtime (updates live,
  no deploy, stream-safe — one always-on component), or
- run locally + commit `promos.json` when convenient.
The fetch needs **no secrets**, so a GitHub Action cron is trivial (just pause it
during streams, or point the page at a non-Pages endpoint).

**✅ BUILT (local, uncommitted):**
- `scripts/telegram-pull.mjs` — no-secret fetch of `t.me/s/rbstorenet` → parses
  product/price/`rbstore.net` link/image(cdn telesco.pe)/store/coupon → writes
  `public/promos.json` (latest 10). Run: `node scripts/telegram-pull.mjs`.
- `src/components/promo-showcase.tsx` — bottom strip in the live view (CTA "VEJA
  MAIS PROMOS NOS GRUPOS DA RBSTORE" + a marquee of image/price/store cards,
  each linking to the deal; text escaped, images from Telegram CDN only).

**Delivery decision still open (CORS — page can't fetch t.me directly):**
`public/promos.json` is currently a **local file** the dev server serves. For
prod, pick one: (a) commit a snapshot (→ Pages deploy, off-stream); (b) GitHub
Action **cron** regenerates + commits it (no secret needed; each run = Pages
deploy, so pause during streams); (c) a tiny **non-Pages endpoint** serves it so
the page fetches live with no deploy (stream-safe updates). Until then it's
local-only and refreshed by re-running the script.

---

## Route A — MTProto *user client* (no bot, uses YOUR membership) ✅ recommended

A Telegram **user account** (you) can read any chat you're a member of — exactly
what you see in the app, including a **private** group and its **history**. Libs:
**GramJS** (`telegram`, JS) or **Telethon** (Python). This is a "userbot": it logs
in as your account, not a bot, so no BotFather, no admin rights, no adding a bot
to the group.

What you need (once): `api_id` + `api_hash` from <https://my.telegram.org> → API
development tools, and a one-time phone-code login that yields a **session
string** (reusable; treat it like a password — gitignore it).

Minimal GramJS sketch (read last N messages from the group):
```js
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
const client = new TelegramClient(new StringSession(process.env.TG_SESSION),
  Number(process.env.TG_API_ID), process.env.TG_API_HASH, { connectionRetries: 3 });
await client.connect();
// group by @username, or numeric id, or an invite you're already in:
const msgs = await client.getMessages("rbstore_promos", { limit: 20 });
const items = msgs
  .filter((m) => m.message)               // text posts only
  .map((m) => ({ id: m.id, date: m.date, text: m.message }));
console.log(JSON.stringify(items, null, 2));
```

Caveats:
- **ToS:** automating a *user* account is discouraged by Telegram; read-only at
  low frequency is low-risk but can flag an account if abused. Don't hammer it.
- The **session string is a full credential** to your account — store it only in
  a gitignored env / CI secret, never in `src/`.

## Route B — public channel web preview (zero auth, NO login at all)

If the "group" is actually a **public channel** with a `@username`, the last
posts are readable with no auth at `https://t.me/s/<username>` (server-rendered
HTML you can scrape). Works only for public **channels**, not private groups.
Cheapest possible option if it applies.

## Route C — manual export (zero infra)

Telegram **Desktop → ⋯ → Export chat history → JSON**. Curate into a static
`public/promos.json`; the page renders it. No automation, you refresh when you
want. Fits the no-backend posture; good if promos are infrequent.

---

## Getting it onto the static page (GitHub Pages)

The site is static, so the items must land as data the page can fetch:
- **Local-run + commit** (simplest, stream-safe to *prepare*): run Route A/C
  locally → write `public/promos.json` → commit. ⚠️ Committing to **main** is a
  Pages deploy → reloads the stream. So prep anytime, **merge after the stream**
  (or at halftime). Page reads `promos.json` and renders.
- **GitHub Action cron** (auto): a scheduled workflow runs GramJS (session string
  as a repo secret), writes `public/promos.json`, commits. ⚠️ Each run is a
  Pages deploy → **reloads the stream**. So either pause the cron during streams
  or have the page fetch the JSON from a *non-Pages* endpoint instead.
- **Tiny always-on endpoint** (live, no Pages deploy per update): a small service
  runs the userbot and serves `/promos.json`; the page fetches it client-side at
  runtime. Updates appear without any deploy (stream-safe), at the cost of one
  always-on component (same tradeoff as the live-score poller idea).

## Security (whatever route)
- **Never render raw message HTML/markup.** Whitelist to plain text (+ maybe a
  vetted link). Same discipline as the reactions emoji whitelist — messages are
  untrusted input; React escaping + a strict allowlist prevent injection.
- Rate-limit / cache; don't fetch on every page load.

## Recommendation
- Promo posts are low-frequency → **Route A run locally, write `public/promos.json`,
  merge after stream** (or Route C manual). Keeps the no-backend posture and
  never disturbs a live stream.
- Reach for the always-on endpoint only if you want promos to update *live*
  during a stream without a deploy.

**Spike status:** no live prototype here — Route A needs your `api_id`/`api_hash`
+ a phone-code login I can't perform. The sketch above is runnable once you add
those to a gitignored env. Say the word and I'll scaffold a local
`scripts/telegram-pull.mjs` (gitignored) that writes `public/promos.json`.
