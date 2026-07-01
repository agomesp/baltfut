## Target architecture & the cheap-server verdict

### Recommended target architecture (stays fully free until a concrete trigger)

**Client — GitHub Pages, static `output:export` (the realism lives here):**
- **Deterministic seeded sim in a Web Worker.** `createMatchSim` is already pure TS with no DOM — porting it is near-zero effort. Replace all ~20 `Math.random()` with a seeded PRNG (`mulberry32`) and step a **fixed 1/30s timestep** keyed to the shared clock. The Worker survives background-tab *data* throttling (`setInterval` keeps firing); the main thread interpolates the last two snapshots.
- **Canvas2D render layer** replacing the 24-setState-per-frame React path. React keeps only discrete UI (scoreboard, ticker, GOAL flash, spectator count). Canvas owns 60fps motion, camera pan/zoom, ball height/shadow, replay ring-buffer.
- **Shared scoreline model** (`xg.ts`): one Dixon-Coles / exp-link function feeds BOTH the authoritative `tournament.ts` result and the sim's shoot utility, so play and outcome agree by construction.
- **Web Audio** for SFX + adaptive crowd bed + (Tier A) Web Speech commentary — audio is NOT rAF-throttled, so the match's *soundtrack* survives a hidden tab even when pixels freeze.

**Supabase — free tier (source of truth + live pulse):**
- A `matches` row: `{ match_id, seed, kickoff_at/startEpochMs, goal_script[], status }` — the entire durable snapshot. Because the sim is deterministic and clock-driven, **no per-tick state is stored**; row + elapsed reconstructs any frame, so join-in-progress and replays are nearly free.
- **Realtime broadcast** (not `postgres_changes`, not positions) for the live pulse: kickoff, goal/card events, ephemeral emotes. **Presence** for the spectator count.
- **`pg_cron` + one Deno Edge Function** to start matches on schedule and advance the bracket authoritatively — the event is real even if only the streamer's browser is open.
- Writes (palpites, chat) route through the existing `cast-vote`-pattern Edge Function with server-side cutoff + RLS, honouring every SECURITY.md invariant.

### The determinism + seed-broadcast approach (why live sharing is free)

This is the load-bearing design and it collapses the "expensive" parts into cheap ones:

```
Broadcast ONCE per match:  { seed, startEpochMs, goalScript }   (~200 bytes)
Every client:              elapsed = serverNow − startEpochMs
                           step deterministic sim → targetTick   (fast-forward if behind)
Per-tick network cost:     ZERO
```

Same seed → identical passes, scrambles, and goal placement on every screen — the classic lockstep/rollback property (StarCraft, GGPO). A refocused hidden tab recomputes `elapsed` and snaps to the correct moment (cap catch-up at ~3s to avoid a spiral-of-death). Clock sync is NTP-lite: ping an Edge Function `now()` 3× on join, take the median offset — sub-100ms is plenty for a cosmetic sim. **The one honest ceiling:** full window *occlusion* (OBS covering the window) still freezes pixels regardless — no web fix; that stays an operational "keep the window visible / PiP" workaround, and the audio layer keeps the match alive for listeners.

### Cheap paid server — honest verdict

**Verdict: stay fully free (static Pages + Supabase). Nothing justifies paying *yet*.** The determinism refactor turns every expensive-sounding capability into a cheap one: compute stays on the client (22 tokens × a few `Math.hypot` calls is <1ms/frame), "authority" is a tiny DB row + broadcast, and scheduling is `pg_cron`. Supabase free tier (200 concurrent Realtime connections, 2M messages/mo) comfortably covers a subs audience of tens-to-low-hundreds because you broadcast the *seed and events*, never positions.

**The escalation ladder, by concrete trigger (only buy when one fires):**

| Trigger | Cheapest viable option | Rough $/mo | Why this one |
|---------|------------------------|-----------|--------------|
| You want Twitch OAuth sub-gating + a live Predictions/channel-points bot (needs a persistent EventSub websocket) | **Cloudflare Worker + Durable Object** (WebSocket Hibernation) | **$0** up to ~3M req/mo, then **$5** Workers Paid | Bills nothing while idle; edge, no cold start; the bot is the first thing that genuinely needs an always-listening process |
| You exceed **200 concurrent Realtime connections** (a big stream) OR want a true server-authoritative game loop with live user inputs | **Cloudflare Durable Objects** (hibernation) as the match "room" | **$5** | Correct next step, NOT a VPS — free until ~3M req, gives authoritative loop if ever needed |
| You want the free-tier 7-day pause gone + 500 connections in one move, zero ops | **Supabase Pro** | **$25** | Buys headroom + no-pause + egress with zero new infra to run |
| You add something genuinely stateful-and-continuous (persistent Node sim, live multiplayer inputs) | **Fly.io shared-cpu-1x 256MB** (~$2) or **Hetzner CAX11** (€4) | **~$2–4** | Cheapest raw always-on compute — but given the cosmetic-sim design, that day may never come |

**The single cheapest thing worth pre-committing to** if the loop proves it holds subs' attention: **one Cloudflare Worker (free tier)** for scheduled kickoff + the Twitch bot — it unlocks the "appointment event" + sub-identity + channel-points betting together at $0–5/mo, and it's the correct architecture (not a VPS "to be safe", which just adds patching, monitoring, and a bill for a compute problem you don't have).

**Determinism note (non-negotiable):** the seeded-sim refactor of `match-sim.ts` is the one hard prerequisite for the entire live-shared layer. It's all one JS engine, so you dodge the cross-language float-drift that plagues real lockstep games — freeze the RNG order and step order and two clients stay byte-identical. Test it TDD-first (two sims, same seed, identical snapshots after N ticks) and everything downstream — shared viewing, catch-up, replays, match reports — is small and additive.
