## Watched-live shared multiplayer for the /subtests match sim

### What the code actually is today (grounding)

The spotlight sim (`src/lib/subs-draft/match-sim.ts`, 673 lines) is a rule-based 2D engine with a clean seam already: `createMatchSim(homeXI, awayXI)` returns `{ step(dt, progress), snapshot(), scoreFor(side) }`. `pitch-view.tsx` drives it with a `requestAnimationFrame` loop, feeding real wall-clock `dt` and `progress = clock/90`; the authoritative scoreline lives in `tournament.ts` and is injected via `scoreFor()` as the local clock crosses each goal minute (`pitch-view.tsx:68-79`). The `Snapshot` (positions + ball + poss% + shots + bookings + event ticker) is compact and serializable.

**Two facts dominate the whole design:**

1. **The sim is NOT deterministic today.** It calls `Math.random()` at ~40 sites, including `let poss = Math.random() < 0.5` at init (`match-sim.ts:74,91`). So the headline "broadcast a seed and everyone renders identically" trick is *not free* — it requires a determinism refactor first. That refactor is the single highest-leverage piece of work here.
2. **rAF freezes in a hidden tab.** This is already a known, documented project reality (memory: background-tab-throttling — pixels freeze on full occlusion, provably unfixable in-browser). It shapes the sync strategy: clients must be able to *catch up* from clock, not assume continuous frames.

### The core architecture decision (the three options)

**A — Broadcast full state every tick.** Server (or a host client) sends the whole `Snapshot` at, say, 5–10 Hz over Supabase Realtime; clients interpolate between snapshots. Simple, no determinism needed, but ~22 positions × 2 floats + ball + stats ≈ 400–600 bytes/msg × 6/s × N spectators. Supabase free tier caps ~200 concurrent Realtime connections and 2M messages/month — a single 90-min match at 6 Hz burns ~32k messages *per broadcast channel* (broadcast fan-out is 1 send → N receives, so the message budget is on *sends*, which is fine, but the *bandwidth* and the 5-min-max per broadcast still bite). Verdict: works, wasteful, and interpolation of 22 tokens looks mushy.

**B — Deterministic sim + broadcast seed + sparse corrections (RECOMMENDED).** Make the sim a pure function of `(seed, tick)`. Broadcast once: `{ seed, startEpochMs, homeXI, awayXI, goalScript }`. Every client runs the identical sim locally off a shared wall-clock; you send *nothing* per tick. You broadcast only (a) the goal script up front (already authoritative from `tournament.ts`) and (b) rare "keyframe" corrections for join-in-progress. This is exactly how lockstep RTS netcode (StarCraft, Age of Empires) and rollback fighting-game netcode (GGPO) scale to "same game on every machine with almost no bandwidth." Cost is near-zero on free tier; the price is the determinism discipline.

**C — Authoritative tick server (Cloudflare Durable Object / tiny Fly.io box).** A DO owns the canonical clock and sim, ticks it, and broadcasts. This is what real sportsbook/live products (and Colyseus/Hathora game servers) do. It kills clock-drift and cheating and solves join-in-progress trivially (server holds state). But it's a paid/managed dependency the project explicitly wants to avoid unless "clearly worth it," and DO WebSocket hibernation + egress is real money at scale. Verdict: keep as a *later* upgrade only if live betting integrity demands it.

**Opinion:** Go **B**, with Supabase Realtime **broadcast** (not Postgres-changes) as the transport and a single Postgres `match_state` row as the durable snapshot for join-in-progress. That's the cheapest-that-works and it fits static Pages + Supabase perfectly.

---

### Ranked upgrades

**1. Make the sim deterministic (seeded PRNG + fixed timestep). Effort M. Client-only.**
Replace `rnd` and every `Math.random()` with a seeded generator — `mulberry32` (32-bit, one-liner, fast, good enough for cosmetics) or `sfc32` seeded from the match id. Add a fixed-timestep accumulator: step the sim in fixed 1/30 s increments (`while (acc >= DT) { step(DT); acc -= DT }`) instead of variable `dt`, so `tick` count — not frame timing — determines outcome. **Why:** this is the precondition for *every* cheap-sync and tab-freeze fix below; without it, two clients diverge instantly. **Tradeoff:** you must route ALL randomness through the seeded RNG (grep for `Math.random` in `match-sim.ts` and kill each one) and freeze floating-point order — trivial here since it's all one JS engine (no cross-language float drift like real lockstep games fight). This is the load-bearing change; do it TDD-first (a test that two `createMatchSim(seed)` instances produce byte-identical snapshots after N ticks).

**2. Shared clock from a broadcast start-time + local catch-up. Effort S. Supabase.**
Broadcast `{ seed, startEpochMs, goalScript }` on a per-match Realtime channel. Each client computes `elapsed = (Date.now() - startEpochMs + clockOffset)`, derives `targetTick = elapsed / DT`, and in its rAF loop *fast-forwards* the sim to `targetTick` (step in a tight loop if behind). **Why:** everyone converges to the same tick regardless of frame timing, and — critically — **this fixes the tab-freeze for spectators**: when a hidden tab resumes, rAF fires once, sees it's 40 s behind, and simulates forward to catch up (cap the catch-up loop, e.g. skip rendering intermediate frames past ~3 s behind to avoid a spiral-of-death). Do NTP-lite clock sync: on join, ping a Supabase Edge Function `now()` 3× and take the median round-trip offset (the classic Cristian's-algorithm trick). Sub-100 ms accuracy is plenty for a cosmetic sim.

**3. Join-in-progress via a durable snapshot row. Effort S–M. Supabase.**
Keep one `match_state` row per live match: `{ match_id, seed, start_epoch, goal_script, status }`. A late joiner reads the row (a normal anon SELECT — fits the existing RLS-first model), seeds the sim, and fast-forwards to `now`. Because the sim is deterministic (#1) and clock-driven (#2), **no per-tick state needs storing** — the row + elapsed time reconstructs the exact frame. This is the elegant payoff of choosing option B: join-in-progress is nearly free. For events the sim *can't* re-derive (a manual "match paused by admin," an injury override), append them to a small `match_events` table the client replays — mirrors the existing admin palpite-window-override pattern (memory: palpite-window-override — DB row + realtime broadcast).

**4. Scheduled "match day" everyone tunes into. Effort S. Supabase.**
A `matches` table with `kickoff_at` timestamps; the client shows a lobby countdown (reuse `use-now.ts`) and auto-navigates into the pitch view at kickoff. The broadcast `startEpochMs` = `kickoff_at`, so *everyone starts the same sim at the same second*. **Why it sells "watched together":** synchronized kickoff + a shared clock is 80% of the "we're all watching the same thing" feeling. Show a live spectator count via Realtime **Presence** (free, built into the channel) — "142 subs watching" is a huge immersion multiplier for near-zero cost. This is a **quick win**.

**5. Live chat / reactions / emotes. Effort S. Supabase.**
Two tiers: ephemeral emotes over Realtime **broadcast** (fire-and-forget, no DB write — cheap, and floating emoji-over-pitch is the single most "alive" feeling per hour of effort), plus persisted chat in a `chat_messages` table with RLS + rate-limit (route writes through an Edge Function like `cast-vote` already does, to prevent spam/abuse — reuse the IP-hash + validation pattern). **Quick win:** emote bursts on goals (auto-fire a 🎉 storm when `scoreFor` triggers) make the goal moment communal. **Trap:** don't persist emotes — they'll blow the 2M-message/500MB free budget; keep them broadcast-only.

**6. Live in-match predictions tied to palpites/points. Effort M. Supabase + Edge Function.**
"Predict next scorer," "HT result," "who wins the next corner." Open a prediction window (broadcast `{ type:'market_open', marketId, closesAt }`), collect answers through the *existing* `cast-vote`-style Edge Function with a **server-side cutoff** (you already built exactly this — memory: server-side-cutoff — cast-vote rejects late palpites via authoritative time; reuse it verbatim so clients can't submit after the event resolves). Resolve against the authoritative `goalScript`/tournament result, not the cosmetic sim, and award points into the existing ranking system. **Why:** turns passive watching into leaning-forward engagement — the proven live-sports-app hook (DraftKings/bet365 "next goal" markets, Twitch Predictions). **Trap:** resolve on the *authoritative* outcome only; the sim is cosmetic and must never decide who won a bet.

**7. (Optional, later) Authoritative tick server. Effort L. Needs-server.**
Only if live betting volume makes client-clock-trust unacceptable. A Cloudflare Durable Object or a $5 Fly.io box running the same TS sim as the source of truth, broadcasting ticks. Colyseus or Hathora give you room/state management out of the box. **Keep parked** — options 1–3 make this unnecessary for a subs community.

---

### Quick wins vs traps

- **Quick wins:** Presence spectator count (#4), goal-triggered emote storm (#5), synchronized kickoff (#4). Hours of work, outsized "we're here together" payoff.
- **Traps:** (a) Broadcasting per-tick state (option A) — you'll hit bandwidth/interpolation pain for no benefit once #1 exists. (b) Trusting the cosmetic sim to resolve bets — always resolve on `tournament.ts` truth. (c) Ignoring the catch-up cap — an uncapped fast-forward after a long-hidden tab is a spiral-of-death; bound it. (d) Postgres-changes for the live feed — it's heavier and slower than broadcast; use `postgres_changes` only for durable state (the `match_state` row), broadcast for the live pulse.

**Cheapest-that-works, in one line:** deterministic seeded sim (#1) + broadcast `{seed, startEpochMs, goalScript}` over Supabase Realtime with local clock catch-up (#2) + a durable `match_state` row for join-in-progress (#3). Zero per-tick messages, join-anytime, tab-freeze self-heals, and it never leaves the free tier. The determinism refactor of `match-sim.ts` is the one hard prerequisite — everything else is small, additive, and reuses patterns (`cast-vote` Edge Function, realtime broadcast, server-side cutoff, RLS) the project already ships.
