# Match Realism V3 — Target Architecture per Bucket

Two invariants govern all three buckets and every diagram below:

- **Authority plane** — the scoreline, scorers, minutes, cards, bracket draw, and authoritative positions live in `tournament.ts`/`match-sim.ts` and are computed from a **seeded PRNG (`mulberry32`)** with **scaled-integer utilities, a 256-entry integer-exp LUT for softmax, and a fixed-point CDF over `λ·1000`**. `Math.exp`/`hypot`/trig NEVER appear in this plane (the current `poisson()` violates this and must be replaced). Same seed → byte-identical `MatchResult[]` on every client.
- **Cosmetic plane** — lean/bob, IK limbs, pixel skins, ball curve, camera, celebrations, audio, commentary. Uses floats freely, is **read-only over the authority plane**, and **never writes back**. This is why Rain-World-style procedural animation is safe.

The broadcast payload is **seed-only**: `{bracketSeed, perMatchSeeds, startEpochMs, engineVersion}` (~30 bytes). Never per-tick positions. `engineVersion` pins in-flight replays to the sim logic that produced them.

---

## BUCKET A — $0 / current stack

```
                 GitHub Pages (static Next.js export, basePath /baltfut)
                 ┌──────────────────────────────────────────────────────┐
                 │  Web Worker (sim)          Main thread (render, visible-only)
                 │  ─ mulberry32(seed) ───▶   ─ interpolate last 2 snapshots
                 │  ─ tournament.ts (INT)     ─ Canvas2D /subtests2 baseline
                 │    → MatchResult (auth)    ─ camera setTransform + ring-buffer replay
                 │  ─ match-sim.ts (INT pos)  ─ IK bodies + pixel-skin LOD (cosmetic)
                 │  ─ xG/DC unified λ          ─ Web Audio (SFX + adaptive crowd + ducking)
                 │  ─ utility AI (INT LUT)    ─ templated pt-BR commentary (Web Speech)
                 │  ─ fixed 1/30s timestep    ─ broadcast overlays (DOM over canvas)
                 └───────────────┬──────────────────────────┬───────────┘
                                 │ seed + events              │ reads JSON
                                 ▼                            ▼
        Supabase FREE (Realtime broadcast/presence,    public/models/*.json
        `match_state` row, `subs_teams/bracket/status`,  (team-strength, xG coeffs,
        `votes` via cast-vote Edge Fn, Storage=SFX/TTS,   Elo) — read by ai-palpite
        pg_cron scheduled kickoff)                         predict.ts/power.ts seam
                                 ▲
                                 │ weekly commit
                    GitHub Action (Python cron, FREE CI)
                    experiments/football-models/ (uv venv)
                    → fits shrunk time-decayed Dixon-Coles + xG,
                      RPS/reliability pytest gate, seeded manifest
```

**Summary:** deterministic seeded sim in a Web Worker, stepped fixed-timestep against a broadcast `startEpochMs`, painted only when visible; unified xG/DC model drives both on-screen chances and the authoritative scoreline; Supabase `match_state` row + seed/event Realtime broadcast + Presence for watch-together; `pg_cron` kickoff; Python-factory JSON re-fit by a free GitHub Action; replays from `(seed, lineups, engineVersion)`. **Grants tax:** every new table needs explicit grants to service_role + anon, RLS, and `scripts/db/` assertions.

---

## BUCKET B — + one cheap paid host ($2–25/mo)

All of A, plus a thin persistent layer for the three things A physically cannot do. Buy per-need, not one box for all three.

```
        All of Bucket A
               │
     ┌─────────┼───────────────────────────┬──────────────────────────┐
     ▼         ▼                            ▼                          ▼
 Cloudflare Worker + Durable Object   Supabase Pro $25            Durable Object
 (free→$5)                            (kills 7-day pause,         + WS Hibernation
 ─ Twitch OAuth token cache/refresh    500 conns, more egress)   (free ~3M req/mo)
 ─ EventSub persistent WebSocket      bought ONLY when Presence   ─ server-authoritative
 ─ open/resolve Twitch Predictions     churn threatens 2M-msg      live loop (tamper-proof
 ─ channel-points/bits betting bot     quota at real scale         clock, live inputs,
 ─ live in-match prediction markets                                >200 spectators;
   (resolved on AUTHORITATIVE score)                               occluded-tab re-sync;
                                                                   rapier2d-WASM authority)
```

**Summary:** all of A, plus one Cloudflare Worker + Durable Object (Twitch OAuth/EventSub, token cache, betting bot, and — if ever needed — a hibernating authoritative live room for >200 viewers or tamper-proof integrity), and Supabase Pro $25 *only* to remove the idle-pause and raise conn/quota at real scale.

**Bucket boundary rule:** scheduled kickoff STAYS in A (`pg_cron`). Only the persistent-secret loop (Twitch) and the authoritative live loop are *born* in B. Never host the kickoff path behind a scale-to-zero cold start (Render/Railway ~60s spin-up is disqualifying; DO hibernation / Fly always-on avoid it).

---

## BUCKET C — + GPU (RTX 3060 12GB)

All of B, plus the GPU used ONLY as an offline factory and a streamer-local render — never as a live viewer-facing producer.

```
        All of Bucket B
               │
   ┌───────────┴──────────────────────────────┬───────────────────────────┐
   ▼ (mode i — OFFLINE, GPU then OFF)          ▼ (mode ii — streamer-local) │
 RTX 3060 12GB training box                  Streamer's browser (WebGPU)    │
 ─ imitation off-ball policy → int8 ONNX     ─ full-screen post-FX shader   │
 ─ better xG/xT weights → JSON                 (bloom/motion-blur/CRT)      │
 ─ [PARKED] MARL self-play, off-ball ONLY     ─ hundreds of sprites/particles│
 ─ asset factory: sprite atlases, baked       ─ optional live cosmetic ML   │
   lighting, celebration cinematics → PNG       (int8+backend-pinned)       │
        │ commit via the A3.5 Action pipeline                               │
        ▼                                    phone viewers → fall back to A  │
   public/models/*.onnx + public/assets/*.png                              │
   (thin TS / onnxruntime-web inference at runtime — runtime stays Bucket A) │
                                                                            │
   C4: token-gated FastAPI behind free Cloudflare Tunnel (streamer control  │
       panel only — SPOF, never in a viewer's path)                        │
   C5 REJECTED: live GPU → Supabase position stream (redundant, quota bomb, │
       breaks determinism)                                                  │
```

**Summary:** all of B, plus the RTX 3060 as an **offline factory** exporting int8 ONNX / JSON / PNG into the same A3.5 artifact pipeline (off-ball motion policy, better xG/xT weights, high-fidelity assets), plus optional **streamer-local WebGPU** high-fidelity post-FX render (broadcaster's screen only; phones fall back to A), plus a token-gated Cloudflare-Tunnel FastAPI control panel for the streamer's own hand. **No live GPU in any viewer's path, ever.** MARL self-play stays a parked spike (it fights the authoritative scoreline).

---

## The cost ladder

| Tier | Cost | What it adds | What it does NOT add |
|---|---|---|---|
| **A** | **$0** | The entire game: seeded deterministic sim, unified xG/DC model, "IA vs você" prediction product + RPS scoring + Monte-Carlo title race, camera/replay/audio/commentary, watched-together via seed-broadcast, persistent teams + palpites + draft night + rivalries, `pg_cron` scheduled kickoff, weekly Python-factory re-fit | Twitch integration, tamper-proof clock, >200 conns, no-pause uptime |
| **+B** | **$0–5** (CF Worker+DO) then **+$25** (Supabase Pro) | Twitch OAuth/EventSub sub-gating + betting bot + live markets; server-authoritative live loop (integrity/scale); removal of 7-day pause; higher conn/quota | Nothing on-field; nothing in predictions (both stay A) |
| **+C** | **$0** marginal (owner owns the GPU) | Offline-trained off-ball policy + better xG/xT weights + high-fidelity assets (committed static); streamer-local WebGPU broadcast render | Anything viewer-facing at runtime; the GPU never serves live |

**The honest verdict:** the marquee capabilities — a real predictive model, a fair competition, a synchronized watch-party, and a legible living match — are *all* Bucket A. The constraint was never infrastructure; it was the missing shrinkage, the missing calibration harness, the missing sim→body animation seam, and the un-seeded RNG. B buys reliability and Twitch reach; C buys learned/high-fidelity polish offline. Spend up the ladder only when a real audience makes each tier load-bearing.

---

## The determinism / authority guardrail (spans all three buckets)

This is the single rule that makes the entire ladder coherent and keeps Bucket A free:

1. **Seed `tournament.ts` FIRST** (all 11 `Math.random()` sites), then `match-sim.ts` (all 20). One `mulberry32` stream keyed on `bracketSeed` + per-match seeds.
2. **Authority is integer/fixed-point.** Sample goals from a fixed-point CDF over `λ·1000`; select utility-AI options via a 256-entry integer-exp LUT. No `Math.exp`/`hypot`/trig in the authority path — they are not IEEE-754 bit-identical across V8/JSC/Gecko and will micro-diverge across browsers.
3. **Cosmetics are float and one-way.** IK bodies, pixel skins, ball curve, camera, audio, and celebrations read the authority snapshot and never write back. This is why they're safe despite using non-reproducible float math.
4. **Broadcast seed-only**, never positions. `{bracketSeed, perMatchSeeds, startEpochMs, engineVersion}`.
5. **Clock sync** = Cristian's algorithm (median of 3 Edge `now()` pings). **Catch-up cap** = if >3s behind, fast-forward the sim but skip rendering intermediate frames; hard-cap the loop so it can never spiral.
6. **`engineVersion` in every replay tuple** so a deployed sim change can't silently corrupt in-flight replays.

The moment any float ML (Bucket C onnxruntime-web) is shipped to or across clients, it must be **int8-quantised and backend-pinned**, or it detonates the seed-replay invariant. Keep learned models offline (mode i) or streamer-local and cosmetic (mode ii). This guardrail is why $0 works, why watch-together is free, and why the GPU never needs to serve.
