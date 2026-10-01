# baltfut — Performance & Resource Spike Study

**Date:** 2026-07-11 · **Build:** Next 16.2.9 (Turbopack), React 19.2, static export · **HEAD:** 75db891
**Method:** production build measured on disk (raw + gzip), live ESPN/Supabase payloads measured over the wire, plus two focused code audits (runtime CPU/animation, network/data). Every number below is measured, not estimated, unless marked *(est.)*. Supersedes the *perf* half of `AUDIT.md` (2026-06-27) with hard numbers; the June top-priorities (per-second re-render, poller consolidation A2, `.order()` B1) are **already shipped** and verified still-good here.

---

## TL;DR — where the resources actually go

Two things dominate, and **neither is the bundle**:

1. **🌐 The live scoreboard re-downloads the entire 104-match tournament every 20 s.**
   `scoreboard-source.ts:36` polls the full `dates=20260611-20260719&limit=400` range = **91.7 KB gzip (1.12 MB raw) per poll → ~275 KB gzip/min → ~16.5 MB/hour, per client.** That's **93 % of the app's whole network budget**, burned to keep *today's* 1–2 live matches fresh. Today-only is **3.6 KB gzip — 25× smaller.** This is the single highest-leverage fix in the app.

2. **🎨 The AO VIVO hero paints non-compositable animations continuously.** The promo board people worried about is fine (its glow was already de-animated). The real steady cost is the **hero that's on camera for hours during a stream**: an animated `conic-gradient` event timeline (`bf-evt`), 12–24 blurred "squad-wall" auras, and animated `filter: blur` crests — all repainting every frame, forever, on the one screen a streamer never navigates away from.

The **first-load bundle is 377 KB gzip of JS** — heavier than a scoreboard app needs (supabase-js rides first paint though the app only uses 2 of its 5 sub-clients), but it's a one-time cost and a distant third behind the two above.

**If you do only three things:** (1) narrow the live poll to today, (2) de-animate the `bf-evt` timeline, (3) stop `loadAll` double-fetching the scoreboard. Rough effect: **network −9×, hero paint budget recovered, ~92 KB gzip saved on every load/focus.**

---

## Measured resource budget (current, per client)

| Axis | Now | After Tier-1 fixes | Notes |
|---|---|---|---|
| **First-load code** | ~390 KB gz (JS 377 + CSS 7 + HTML 6) | ~330 KB gz | + a subset of fonts (~80–160 KB) + first data pull |
| **First data pull** | ~115 KB gz (scoreboard 91.7 + standings 7.9 + votes 11.8 + …) | ~27 KB gz | scoreboard is almost all of it |
| **Steady-state network (live tab)** | **~295 KB gz/min ≈ 16.5 MB/hr** | **~30 KB gz/min ≈ 1.8 MB/hr** | scoreboard = 93 % |
| **Hidden/background tab** | same full rate (by design) | throttled unless streamer-mode | every backgrounded tab currently keeps polling |
| **Continuous CPU (live)** | paint-bound hero animations, never pause | composite-only | worst on a multi-hour stream capture |

---

## Findings — ranked across all axes

Severity = measured resource impact × how often it's paid. `[N]` network audit, `[C]` cpu/anim audit, `[B]` bundle, `[A]` assets, `[H]` hygiene. Effort: 🟢 ≲1 h · 🟡 a few h · 🔴 half-day+.

### ⭐ Tier 1 — do first (huge, mostly cheap)

**N1 · Narrow the live scoreboard poll to *today*. 🟡**
`src/lib/scoreboard-source.ts:36` → `scoreboardUrl(DEFAULT_LEAGUE, FIFA_WORLD_DATE_RANGE)`, `POLL_MS = 20_000`.
The one shared worker fast-polls the **whole tournament** (91.7 KB gz/poll). Live freshness only needs today's fixtures (**3.6 KB gz**). The full 104-match range is only needed by the **Fixtures / Results / Bracket / AI** tabs and bracket seeding — none of which need 20-second freshness.
**Fix:** live poller fetches today (or ±1 day) at 20 s; fetch the full range **lazily** on those tabs opening, plus a slow (~3–5 min) backstop for bracket seeds. Because ESPN sends `cache-control: max-age=8` and we poll at 20 s, the browser cache never dedupes today's poll — so this is pure savings: **≈ 15.5 MB/hr/client** and ~3.4 MB/min *less* JSON to parse on the main thread.
*Watch-outs:* `matches` currently feeds every tab from this single source — the split must keep those tabs correct (merge today-live into the full-range snapshot). This is the one Tier-1 item that's a real refactor, not a one-liner.

**C1 · Replace the `bf-evt` conic-gradient timeline chips with static rings. 🟢**
`src/app/globals.css:278-339` (`bfEvtSpin` animates a `@property --bf-evt-angle` 0→360°), used at `src/components/live/hero-scoreboard.tsx:43`.
Each goal/card chip animates **two `conic-gradient` layers + a `filter: blur(4px)`** at ~60 fps. Animated conic-gradient angle is **not compositable** — full gradient repaint every frame, ×N chips (8–15 in a lively knockout), on the always-on hero. This is *the exact effect the team already deleted from the 50-card promo board* for this reason — it was just left on the live timeline. `prefers-reduced-motion` already disables it (`globals.css:445`), proving it's droppable.
**Fix:** static per-kind ring/border (reuse the promo-panel `GLOW` pattern); if motion is wanted, pulse `opacity` (compositable) and/or cap to the 3 most-recent events.

**N4 · Stop `loadAll` + `visibilitychange` from re-fetching what the workers already have. 🟢** *(June A3, still present)*
`src/app/page.tsx:206-231` main-thread `loadAll` fetches the full scoreboard + standings, while `subscribeScoreboard` (`:258`) and the standings worker (`:269`) each do an immediate first `tick()` → **scoreboard fetched twice (2 × 91.7 KB gz) and standings twice on every load.** `visibilitychange` (`:486-495`) re-runs the whole `loadAll` on **every tab focus**, though the workers never stopped while hidden, so data is already ≤20 s fresh.
**Fix:** drop scoreboard/standings from `loadAll` (let the workers own them; keep only counts/overrides); gate the on-visible refetch on staleness. **~92 KB gz saved per load and per focus.** (Compounds with N1 — after N1 the double-fetch is small too.)

### Tier 2 — high value

**N2 · Debounce the whole-table votes refetch on realtime nudges. 🟡**
`src/app/page.tsx:378-392` — every `palpites:${activeId}` broadcast calls **both** `loadEntries` **and** `loadAllEntries`, no debounce. `loadAllEntries` = `fetchAllEntries` (whole `vote_entries`, ~12 KB gz now / ~28 KB gz *(est. at 2000 rows)*) + `fetchMatchResults` + `fetchBracketEntries` = 3–4 Supabase requests. A single new palpite for the active match re-pulls **all 104 matches' predictions**; during a goal-driven chat-palpite burst this fires many times/min.
**Fix:** coalesce broadcast→`loadAllEntries` (3–5 s trailing); only `loadEntries(activeId)` needs to be immediate. Let ranking ride its 30 s cadence or merge incrementally.

**B1 · Code-split supabase-js off the first-paint path. 🟡**
`src/app/page.tsx:21` statically imports `@supabase/supabase-js`; chunk `3l4p` (**57 KB gz**, ~pure supabase) loads on `/` even though the ESPN scoreboard — the primary content — needs no Supabase. The client is only *instantiated* inside effects.
**Fix:** `await import()` the supabase surface inside the effects that use it (votes, realtime, promos), so first paint drops ~55–60 KB gz. Low risk (already async/effect-scoped).
**B1b (bigger, optional 🔴):** the app uses **only postgrest + realtime** — never `.auth`, `.storage`, `.functions`, `.rpc` (auth is explicitly disabled, `client.ts`). Swapping the umbrella `createClient` for `@supabase/postgrest-js` + `@supabase/realtime-js` directly drops GoTrue/Storage/Functions from the graph. More effort; measure the real delta before committing.

**N3 + C8 · Mount `KickChatReactions` on the live view only. 🟢**
`src/app/layout.tsx:106` mounts it **app-wide**, opening a Kick Pusher WebSocket (`wss://…pusher.com`) for **every visitor on every tab** (default-on), and floating up to 40 concurrent remote GIF `<img>` decodes + a `setState` each, site-wide, under busy chat.
**Fix:** mount only on the live view (like `Reactions`); open the WS only when a match is live; add `decoding="async"` and a lower concurrent cap. (User toggle already exists as a mitigation.)

**C2 + C3 · Trim the always-on hero blur layers. 🟢**
`squad-wall.tsx:19` renders **6 blurred `filter: blur(9px)` auras/side → 12 (24 in DuoStage)** continuous composited layers; `switching-crest.tsx:23` animates `filter: blur(7px→0→4px)` **8 s infinite ×2 (×4 DuoStage)**. The squad-wall pulse is compositable (fine axis) but it's a lot of large blurred GPU layers, unconditional; the crest *animates the blur radius* (re-rasterizes each frame) though it only matters visually for ~1 s.
**Fix:** fewer auras (e.g. 3/side or crest-only) or one pre-blurred sprite; hold crest blur at 0 during the long steady state, animate it only in the short rise/exit.

### Tier 3 — solid cleanups

**N5 · Throttle the sessionStorage snapshot. 🟢** *(June A7, still present)* — `page.tsx:282-292` `JSON.stringify`s `{matches, groups, voteCounts, entries, allEntries, …}` (~180 KB raw, dominated by `allEntries`) on **every** data change (every 20 s scoreboard tick, 12 s entries, 30 s allEntries, every broadcast). Main-thread stringify + write = jank. **Fix:** throttle to ~once/2–3 s and/or exclude `allEntries` (refetched on reload anyway).

**C5 · PromoSpotlight progress bar: CSS instead of 20 fps React. 🟢** — `promo-spotlight.tsx:48-59` `setInterval(50ms)` → `setState` → animates inline `width` (layout/paint) 20×/s while the promo board is shown (i.e. the whole stream, in promo mode). **Fix:** pure CSS `@keyframes` on `transform: scaleX` (compositable), rotate on `animationend`.

**C6 · Hoist re-injected `<style>` blocks. 🟢** *(June A5, still present)* — `switching-crest.tsx:32`, `squad-wall.tsx:36`, `hero-scoreboard.tsx:92`, `promo-spotlight.tsx:240`, `goal-promo.tsx:29`, `goal-foul-cinematic.tsx:117` each render a static `<style>` in the component body → re-parsed on every render, and 2–4 **duplicate** identical tags when crests/walls mount multiply. **Fix:** module-level once-injected stylesheet or real CSS class.

**C4 · Stop the PixelLabAnim rAF when idle. 🟢** — `pixellab-anim.tsx:67-78` re-arms `requestAnimationFrame` every frame (~60 fps) to draw at 3–4 fps; 2–4 permanent loops on the hero. rAF does pause on a truly-hidden tab but wastes cycles while visible/captured. **Fix:** don't reschedule when `!playing`/last frame; or one shared ticker.

**C7 · `bfstreameralert` glow: opacity, not box-shadow. 🟢** — `globals.css:227-238` animates `box-shadow` + `transform` 1.5 s infinite on the toolbar button whenever streamer-mode is **off** (the default) — continuous paint on every page until toggled on. **Fix:** animate opacity of a separate glow layer, or stop after a few pulses.

**N6 · Parse the scoreboard inside the worker. 🟡** — `scoreboard-worker.ts:22-23` `postMessage`s the **entire 1.12 MB raw JSON** worker→main every 20 s (structured clone), then `parseScoreboard` (zod) runs on the **main thread**; the parsed `Match[]` is only ~35 KB. **Fix:** parse in the worker, post the ~35 KB result (~32× smaller clone, zod off the main thread). *Caveat:* static-export can't bundle a separate worker file cleanly (see memory `background-tab-throttling`) — the blob worker is an ES5 string; needs the parse inlined/bundled. (Naturally shrinks after N1 too.)

**N7 · Merge the three per-match realtime channels. 🟢** — `page.tsx:382,401,427` open `palpites:` / `pen:` / `palpite-window:` for the same `activeId`, all torn down + rejoined on every match switch. supabase-js already multiplexes them over **one** socket, so this is 3 subscriptions not 3 sockets — but each switch is 3 leave/join round-trips that could be 1 `match:${activeId}` channel. Low priority (needs matching broadcast names in `cast-vote`/admin).

### Tier 4 — hygiene & assets (low per-visit cost, worth doing opportunistically)

**H1 · Exclude `/testsprite` + `/testpromos` from the prod export. 🟢** — both ship to Pages (`out/testsprite` 68 KB, `out/testpromos` 64 KB HTML + 12–14 KB gz unique JS) and are publicly reachable. They share big chunks with `/`, so per-visitor JS impact is small — this is **hygiene** (don't expose experiments) + deploy/build cleanliness.

**H2 · Remove the `@base-ui/react` dead dependency. 🟢** — declared in `package.json`, **0 import sites** in `src`, nothing transitively depends on it. Unimported → not bundled (no perf impact) but it's install-time weight + `npm audit` surface. Verify, then drop.

**A1 · Reaction GIFs are 1.76 MB of *fallbacks*. 🟢** — `reactions.tsx:18-23` primary src is remote Kick emotes; the local `r4.gif` (**1.1 MB**) and `r1.gif` (**660 KB**) are `fallback`-only (served only when Kick's CDN fails). Off the critical path, but absurd for an emote fallback and pure repo/deploy bloat. **Fix:** shrink to small WebP/APNG or drop the two giants.

**A2 · Right-size the heavy coat-of-arms flags. 🟢** — `flags/rs.svg` 177 KB (49 KB gz, **267 `<path>`**), `es.svg`, `mx.svg`, `hr.svg`, `ec.svg` are genuine detailed vector. **SVGO barely helps (177→175 KB — already minified).** They're conditional (only when those teams show) and render *tiny* (crests), where the coat-of-arms detail is invisible. **Fix:** serve a simplified flag (or a small raster at display size) — not compression. Low priority (conditional, off critical path).

**A3 · TwemojiCountryFlags webfont (80 KB) may overlap the SVG flags. 🟢** — `layout.tsx` loads an 80 KB local flag-emoji webfont *and* the app ships `public/flags/*.svg`. Confirm both are needed (the font is for Windows/Edge emoji-flag text; SVGs are the crests) or scope the font to where emoji flags actually render.

**B2 · Dynamic-import `qrcode.react`. 🟢** — `promo-spotlight.tsx:9` statically imports `QRCodeSVG`, only used in streamer promo mode. Minor; fold into B1's promo lazy-load.

---

## Already good — do **not** "fix" (verified against current code)

- **Scoreboard pollers consolidated (A2 done):** one shared ref-counted worker via `subscribeScoreboard` feeds page + Modo Streamer + PiP + promo-toggle. The old PiP main-thread `setInterval` is gone. `page.tsx:270`'s second worker is **standings** (different URL), not a dup.
- **The 50-card promo glow is static now**, not animated (`live-promos-panel.tsx:14-17`) — the old CPU worry is *already resolved*. (Memory note about "~50 animated glows" is stale.)
- **No `<video>` decode cost in prod:** `LoopVideo` and `promo-showcase` are **dead code** (no mount); `rigged-footballer`/`lpc-sprite` are `/testsprite`-only. The keep-alive is the tiny PiP clock, not a looping video. (Memory note about keepalive webm/mp4 is stale.)
- **Timer/subscription hygiene is clean:** `heartbeat`, `use-now`, `scoreboard-source` are ref-counted singletons torn down on last-unsubscribe; every promo poller clears its interval; cinematics clear their timers; `update-banner` guards auto-reload against streaming/hidden/typing. (June A9 one-shot `setTimeout`s in `reactions`/`kick-chat-reactions` are **not** real leaks under React 19 — nothing accumulates.)
- **`prefers-reduced-motion` kills all decorative animation** (`globals.css:445`) — a real battery/a11y fallback that also disables P-C1/C2/C3/C7.
- **Composite-only animations** (`bfpulse`, `bfsheen`, `bfwave`, `bfbob`, `baltfutFloat`, promo marquee, `recBlink`) — leave them.
- **Data-layer correctness:** explicit `.order()` on vote fetchers (B1), `fetchAllEntries` pagination past the PostgREST 1000-row cap, lineups fetched once per switch (never polled), bracket + AI-palpites computed **client-side (zero network)**, promos on a cheap 4-min poll, CSS a tiny 7 KB gz, lucide imported tree-shakeably, fonts self-hosted+subset via `next/font`.

---

## Recommended order of attack

Each lands TDD-first on a green branch (typecheck + lint + `npm test` + `npm run build`), per project discipline.

1. **N1** — narrow the live poll to today (+ lazy full-range). *The* win: −15.5 MB/hr/client. 🟡
2. **C1** — de-animate the `bf-evt` timeline. Recovers hero paint budget (streamer heat/battery). 🟢
3. **N4** — kill the `loadAll`/onVisible double-fetch. −92 KB gz per load & focus. 🟢
4. **N2** — debounce the whole-table votes refetch on nudges. 🟡
5. **B1** — code-split supabase off first paint. −~57 KB gz first load. 🟡
6. **N3+C8 / C2+C3 / N5 / C5** — mount Kick chat on live-only; trim hero blur layers; throttle the snapshot; CSS-ify the promo progress bar. 🟢×4
7. **Mop-up:** C4, C6, C7, N6, N7, H1, H2, A1–A3, B1b, B2.

**Verify with the browser preview** after N1/N4 (Network panel: confirm the live poll is now ~4 KB and the double-fetch is gone) and after C1/C2/C3 (Performance panel or paint-flashing: confirm the hero stops repainting at idle).

---

## Appendix — methodology & raw numbers

- **Bundle:** `next build` (static export) → `out/` 8.7 MB; JS `.next/static` = **1459 KB raw / 404 KB gzip** across 18 chunks; `/` loads 12 async chunks = **1382 KB raw / 377 KB gz**. Biggest chunks (gz): app+zod+lucide 67 · react-dom 69 · supabase 57 · supabase(partial) 43 · 49. CSS 7 KB gz. Fonts 44 woff2 / 720 KB shipped (subset per-visit), TwemojiCountryFlags 80 KB.
- **Network (measured live, 2026-07-11):** full-range scoreboard **91.7 KB gz / 1.12 MB raw / 104 events / `max-age=8`**; today-only **3.6 KB gz / 2 events**; standings 7.9 KB gz; `fetchAllEntries` 838 rows = 11.8 KB gz; promos ~2 KB gz/4 min. Steady-state live tab ≈ **295 KB gz/min, scoreboard 93 %.**
- **Assets:** `public/` 4.4 MB — reactions 1.9 MB (r4.gif 1.1 MB, r1.gif 660 KB, both fallbacks), promos-cutouts 1.0 MB, pixellab-assets 732 KB (live goal cinematic, lazy), flags 708 KB (5 heavy coats-of-arms). `images: { unoptimized: true }` is forced by static export → no runtime resizing.
- **Audits:** two code-reading passes (runtime CPU/animation; network/data) cross-checked against the June `AUDIT.md`; every finding re-verified against current `file:line`.

*Spike output — disposable/reference. Not committed to app source. Fixes are separate TDD tasks.*
