## Architecture, Compute & Hosting — Where Each Capability Should Run

### The core insight: this sim is already free-compatible — the risk is *watching together*, not compute

The engine (`src/lib/subs-draft/match-sim.ts`, ~673 lines) is a per-frame rule-based 2D sim stepped by `requestAnimationFrame`. Cost-wise it is trivial: 22 tokens × a handful of `Math.hypot`/`lerp` calls per frame is well under 1 ms/frame on any phone. **You do not need a server for compute.** What you *do* need to decide is a much cheaper question: how do 30–300 subscribers see *the same match at the same moment* when the scoreline is authoritative (`tournament.ts`) but the play is generated locally and `rAF` freezes in a background tab.

Two facts pin the whole architecture:
1. The sim is **cosmetic and scriptable** — the final scoreline is fixed, goals are placed into a corner past a beaten keeper. That means the entire match can be reproduced from `(seed, homeSlots, awaySlots, scriptedGoals)`. This is the classic deterministic-lockstep property that RTS/fighting games use for replays and spectating: same seed + same inputs → identical frames. You get "everyone sees the same match" **for free** if the sim is made deterministic.
2. `rAF` freezes when occluded (your `background-tab-throttling` memory already proved pixels freeze and this is *not* web-fixable). So sync cannot depend on client wall-clock accumulated via `rAF`.

Combine them and the answer falls out: **make the sim deterministic and drive it off a shared server clock, not local frame accumulation.** No heavy server compute anywhere.

### The single change that unlocks everything (do this first)

**Rank 1 — Seed + deterministic RNG + shared match clock. Effort: M. Runs: client-only sim + Supabase Realtime broadcast + one small DB row. Quick win, and a prerequisite for almost everything below.**

Replace `Math.random()` (used throughout: `rnd`, and every accuracy/tackle roll) with a seeded PRNG — `xorshift128+` or `mulberry32` (10 lines, no dependency), exactly the Klotho/lockstep pattern the industry uses. Then key the sim off **match time from a server-owned start timestamp** instead of accumulated `rAF` dt: on each frame, compute `elapsed = (serverNow − matchStartedAt)` and step the sim *to* that elapsed time (fast-forward if the tab was throttled and fell behind). Publish `{matchId, seed, startedAt, scriptedGoals[], status}` as a Supabase Realtime broadcast + a `matches` row.

Why this is the keystone:
- **Everyone watching sees the identical match** (same seed → same passes, same scramble, same goal placement) — the "watched together" realism goal, at zero marginal server cost.
- **Background-tab freeze becomes cosmetic, not desync**: a re-focused tab recomputes `elapsed` and snaps to the correct moment. It can even *re-derive* the last N seconds deterministically to avoid a jarring jump (bounded catch-up loop).
- Late joiners get the live moment instantly.
- Supabase Realtime free tier = **200 concurrent connections, 2M messages/mo** — a broadcast every few seconds (goal events, clock corrections) for a sub-only audience of tens-to-low-hundreds fits comfortably. You are *not* streaming 60 fps positions over the wire (that would blow the message budget and defeat the point) — you stream the *seed and events*, and each client renders locally.

Trap to avoid: do **not** try to sync by broadcasting player coordinates every frame. That is the naive approach, it saturates Realtime, and it throws away the determinism you already have.

### Ranked upgrades

**Rank 2 — Move the sim step loop into a Web Worker + `setTimeout`-driven fixed timestep, render via `postMessage`. Effort: S–M. Runs: client-only. Quick win.**
The sim state (positions, ball, FSM) is pure data — perfect for a Worker. Workers are throttled less aggressively than `rAF` in background tabs (your own memory: "DATA throttling fixed w/ Web Workers"). Step the physics on a fixed `dt` (e.g. 1/30 s) inside the Worker keyed to the server clock; the main thread only interpolates the last two snapshots onto the pitch via `rAF` when visible. This decouples *simulation correctness* from *paint*, so a throttled tab stays time-correct and just stops painting — exactly what you want. `OffscreenCanvas` is a later option but unnecessary while players are dots.

**Rank 3 — Scheduled/authoritative match kickoff via Supabase Edge Function + `pg_cron`. Effort: S. Runs: Supabase.**
For a tournament to feel like a live event, matches must *start on a schedule* independent of any client being open. Use `pg_cron` (Supabase includes it) to flip a match to `live` and stamp `startedAt`/`seed` at kickoff, and an Edge Function to advance the bracket when the clock passes full-time (writing the authoritative scoreline from `tournament.ts` logic server-side). This makes the event real even if the streamer's browser is the only one open. No always-on server needed — cron + stateless function is the free-tier sweet spot.

**Rank 4 — Believability upgrades to the sim itself (all client-only, no infra). Effort: S each. Quick wins.**
These raise *plausibility of the play*, which the "feels real" goal depends on more than any host choice:
- **Ball trajectory easing & spin drift** on passes/shots (you already have `BALL_FRICTION`/`SHOT_FRICTION` — add a slight curve on crosses).
- **Anticipatory positioning**: off-ball players run into space ahead of the ball, not toward it (steer toward a predicted receiving lane). This is the single biggest "these look like footballers" tell.
- **Set-piece variety & momentum swings** seeded so scripted goals arrive after *plausible* build-up rather than out of nowhere. Because the scoreline is fixed, bias the RNG so the losing side gets pressure spells — real matches ebb and flow.
These are pure-TS edits to a file you already own; they are the highest realism-per-hour work available and cost nothing to host.

**Rank 5 — Persisted replays + "match report" from the seed. Effort: S. Runs: Supabase Storage/Postgres.**
Since a match = `(seed, lineups, goals)`, store that tiny tuple, not video. Anyone can replay a past knockout deterministically, and you can generate a stats/highlights report. Near-zero storage (bytes per match). This is the deterministic-replay payoff the lockstep literature calls out.

### Hosting verdict — what runs where, and does anything justify paying?

| Option | Cost/mo (2026) | Always-on / cold start | WebSockets / stateful | Cron | Ops effort | Fit here |
|---|---|---|---|---|---|---|
| **Static Pages + Supabase free** | **$0** | n/a / instant | Realtime (200 conn, 2M msg) | pg_cron | none | **Chosen** — covers 100% of the above |
| Cloudflare Workers + Durable Objects | $0 (free ~3M req/mo) → $5 Workers Paid | edge, ~instant | DO + WebSocket **Hibernation** (no idle billing) | Cron Triggers | low | Best paid *if* you outgrow Realtime's 200 conns or need a true authoritative game loop |
| Fly.io shared-cpu-1x 256 MB | ~**$2/mo** always-on | always-on | full WS, stateful | app cron | medium (VM ownership) | Overkill unless you need a persistent Node game server |
| Hetzner CX22 / CAX11 | €3.79 / €5.99 | always-on | anything | system cron | highest (you patch the box) | Cheapest raw compute, but you don't need raw compute |
| Railway Hobby | $5 min (incl. $5 credit) | scale-to-zero → cold start | yes | yes | low | Fine, but pricier than Fly for always-on |
| Render Hobby | $0 + spin-down (~60 s cold) | cold start kills "live" feel | yes | yes | low | Cold start is a **trap** for a live-match product |
| Supabase Pro | $25 | n/a | 500 conns, no 7-day pause | pg_cron | none | Only worth it at scale or to stop the free-tier pause |

**Verdict:** *Nothing justifies paying yet.* The static-Pages + Supabase-free path covers every capability above because the expensive-sounding parts (heavy sim, server-authoritative live match, scheduled sims) collapse to *cheap* parts once the sim is deterministic-from-seed: compute stays on the client, "authority" is just a tiny DB row + broadcast, and scheduling is `pg_cron`.

**The one realistic paid escalation, ranked by trigger:**
1. **You exceed 200 concurrent Realtime connections** (a big stream). Cheapest fix that fits the ethos: **Cloudflare Durable Objects + WebSocket Hibernation** as the match "room" — free up to ~3M requests/mo, bills nothing while idle, and gives you a genuinely server-authoritative loop if you ever want *live user inputs* mid-match. This is the correct next step, not a VPS.
2. **You want the streamer's box to never be load-bearing / no free-tier 7-day pause** → **Supabase Pro at $25** buys 500 connections + no pause + more egress in one move, zero ops.
3. Only reach for **Fly.io (~$2) or Hetzner (€4)** if you later add something genuinely stateful-and-continuous (e.g. a persistent Node authoritative sim with live multiplayer inputs). Given the cosmetic-sim design, that day may never come.

**Trap to avoid:** Render's free spin-down (~60 s cold start) is disqualifying for a "live match starting now" product — never host the kickoff path behind a cold start. And don't reach for a VPS "to be safe": it adds patching, monitoring, and a bill to solve a problem (compute) you don't have.

### Recommended target architecture

- **Client (GitHub Pages, static):** deterministic seeded sim in a **Web Worker**, stepped on a fixed timestep against the **server clock**, painted on the pseudo-3D pitch only when visible.
- **Supabase (free):** `matches` table (`seed`, `startedAt`, `scriptedGoals`, `status`) as the source of truth; **Realtime broadcast** of kickoff + goal/card events (not positions); **pg_cron + Edge Function** to start matches and advance the bracket authoritatively; **Storage/Postgres** holding the `(seed, lineups, goals)` tuple for replays.
- **Paid, only on a concrete trigger:** Cloudflare Durable Objects (hibernation) for >200 concurrent viewers or live inputs; Supabase Pro to kill the free-tier pause at scale.

Do Rank 1 first — it is the hinge that keeps everything else free.

Sources: [Fly.io pricing](https://fly.io/docs/about/pricing/), [Cloudflare Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/), [Durable Objects WebSocket Hibernation](https://developers.cloudflare.com/durable-objects/examples/websocket-hibernation-server/), [Hetzner Cloud pricing](https://costgoat.com/pricing/hetzner), [Supabase Realtime limits](https://supabase.com/docs/guides/realtime/limits), [Supabase pricing](https://supabase.com/pricing), [Railway plans](https://docs.railway.com/pricing/plans), [Render free tier 2026](https://render.com/articles/platforms-with-a-real-free-tier-for-developers-in-2026), [Klotho deterministic lockstep framework](https://github.com/xpTURN/Klotho), [Lockstep netcode architecture](https://www.snapnet.dev/blog/netcode-architectures-part-1-lockstep/).
