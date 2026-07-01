# Spike v3 — critique of v1+v2, mixed into one plan, re-organized into THREE BUCKETS

> Research spike v3 (2026-07-01). **Docs only — no code changed.** Companions: [../spike-subs-match-realism/](../spike-subs-match-realism/) (v1) and [../spike-subs-match-realism-v2/](../spike-subs-match-realism-v2/) (v2), both unchanged. V3 critically re-reads v1+v2 **and the actual code + the /subtests2 IK prototype**, reconciles their disagreements, and — assuming **no time constraints** (the long game, done properly) — re-organizes EVERYTHING into three stacking buckets:
>
> - **Bucket A** — $0, current stack (GitHub Pages static + Supabase free tier + free GitHub Actions).
> - **Bucket B** — A + one **cheap paid server** (what it unlocks + cheapest right option).
> - **Bucket C** — B + **GPU hardware** (a home/streamer GPU feeding a server, OR the streamer's GPU running heavy things live in the browser).

# Match Realism V3 — Executive Overview

## What V1 and V2 got right

- **The determinism keystone is the hinge of the entire project.** Making the sim a pure function of `(seed, tick)`, driven off a *server-owned start timestamp* rather than accumulated `rAF` dt, simultaneously delivers: watched-together sync (same seed → identical frames, classic lockstep), a self-heal for the background-tab freeze (a refocused tab recomputes `elapsed` and fast-forwards), free replays from `(seed, lineups, engineVersion)`, and cross-client integrity. Both spikes land this and it is correctly #1.
- **"You do not need a server for compute."** 22 tokens × a few `hypot`/`lerp` per frame is sub-millisecond. Predictions (Dixon-Coles MLE, Elo, 50k-run bracket Monte-Carlo) are CPU-millisecond work. The heavy-sounding parts (heavy sim, authoritative live loop, scheduled kickoff) collapse to cheap parts once the sim is deterministic.
- **The GPU is a factory that is OFF when users visit.** A live position-producer at ~15 msg/s exhausts Supabase's 2M-msg/month free quota in ~36 hours — and is redundant anyway, because a ~30-byte seed recomputes the match on every client for free. The GPU trains artifacts; it never serves.
- **Python-factory-as-GitHub-Action, not Edge Function.** Supabase Edge Functions are Deno; they can't run scipy/statsmodels. A weekly cron Action that regenerates `public/models/*.json` and commits it is the only sane re-fit loop, and push-to-main already auto-deploys Pages.
- **The cosmetic/authority firewall.** The IK/Verlet body layer uses `sin/sqrt/lerp`, is non-reproducible across engines, and is safe *only because it is read-only decoration* over integer-authoritative positions. The `/subtests2` prototype already obeys this (velocity derived by finite difference, never fed back). This is the best-executed idea across both spikes and must remain law.
- **The `ai-palpite` prediction seam is pre-cut.** `predict.ts`/`power.ts` is *already* a thin evaluator reading baked coefficients — verified: `power.ts` is a hand-typed ~60-team `POWER` table (`BASE_POWER = 62`), and `predict.ts` is two magic constants (`1.3 ± gap·0.6`). The whole "Python factory → commit JSON → thin TS inference" pattern is not a new system; it is a *swap of 60 integers + 2 constants* for a fitted `public/models/team-strength.json` read by the same-shaped functions.

## What V1 and V2 got wrong or under-scoped

- **The two-disconnected-models root problem.** Confirmed in code: `tournament.ts` (11 `Math.random()` sites) decides the scoreline by Poisson-from-average-rating and scripts a ball into a corner; the on-pitch `match-sim.ts` (20 `Math.random()` sites) is pure cosmetic theatre. Both spikes circle this; neither fully internalizes that it is *the* thing to fix, and V1 aims the determinism refactor at the wrong file — **`tournament.ts` must be seeded FIRST**, or every viewer sees synced dots over a *different scoreline and a different bracket draw*.
- **`{seed, startEpochMs, goalScript}` is internally contradictory.** If the seed derives the goals, there is no separate goalScript. Broadcast **seed-only**; every client recomputes the identical bracket + result.
- **Float determinism is NOT free "because it's one JS engine."** `hypot`/`exp`/trig are not IEEE-754 bit-identical across V8/JSC/Gecko; over thousands of steps *cosmetic* dots micro-diverge. Fine for cosmetics, fatal if authority ever derives from float positions. The hard rule: **authority stays integer/seeded (fixed-point CDF over `λ·1000`, integer-exp LUT); cosmetics stay float and one-way.**
- **"Convincing IK in weeks" is optimistic.** The `stepGait` foot-plant is a charming first pass with un-tuned magic numbers, no z-lift tied to a real ball, no kick/tackle/turn poses, no ragdoll on `foul()`. Convincing foot-lock across *starts, stops, turns, collisions* is a multi-month grind. Both spikes budget the happy path and omit the transitions where procedural gait always breaks.
- **The prediction fit's biggest hole: no shrinkage.** World-Cup data is catastrophically thin (~64 matches ≈ 2 games/team). A raw MLE overfits to one blowout. The fix is regularization: ridge-shrink toward the pool mean, pool multiple competitions with Dixon-Coles time-decay ξ, and anchor on an external Elo/SPI prior. V1 never says "shrinkage"; this is its largest gap.
- **The substrate debate is over.** V2 already built the Canvas2D successor at `/subtests2` (single canvas, one `draw()`/frame, depth-sorted, analytic 2-bone IK). V1's "#1: migrate the loop off React state" is *retired*. The real unbuilt visual wins are **camera+replay** and **audio**.
- **Outcome-bias is named but not solved.** "Better AI looks unjust when good play contradicts the Poisson result." The real fix isn't a hand-wave nudge — it's the unified xG model (below): if the pitch generates the chances that generate the score, play and result agree by construction.

## The grand vision (no time constraints) and north-star

**A deterministic, seeded football engine where one xG/Dixon-Coles model drives BOTH the on-screen chances and the authoritative scoreline; where a real "IA vs você" prediction product competes in the same palpites feed subs vote in; where subs draft squads, own persistent teams through a season, and watch each knockout match together — synchronized within ~1s by a broadcast seed, narrated by templated commentary over an adaptive crowd bed, on pixel-skinned IK bodies that actually kick, tackle, and celebrate.**

North-star: **"We watched the same match"** must mean the identical scoreline, bracket, scorers, and — cosmetically — the same goal, roar, and replay, reconstructed on every phone from a ~30-byte seed, for $0. Everything else is a skin over that invariant.

## How the three buckets stack

- **Bucket A ($0 — current stack) carries the entire critical path.** Every on-field realism item, the entire prediction/"IA vs você" product, the whole community loop, camera/replay, audio, commentary, and seed-broadcast watched-together are all Bucket A. The constraint was never infrastructure — it was the missing shrinkage, the missing calibration harness, the missing sim→body animation seam, and the un-seeded RNG. Do it *properly* on the free stack.
- **Bucket B (+ one cheap server, $2–25/mo) buys exactly three things A physically cannot:** (1) a persistent secret + token-refresh loop (Twitch OAuth/EventSub sub-gating & betting bot), (2) freedom from Supabase's 7-day idle pause and higher conn/quota ceilings, (3) a truly server-authoritative live loop with live user inputs / >200 spectators / tamper-proof clock. Nothing on-field or in predictions needs B. Scheduled kickoff *stays in A* via `pg_cron`.
- **Bucket C (+ GPU, owner's RTX 3060 12GB) is a research/factory tier.** Its only defensible role is **offline artifact production** (train RL off-ball motion or better xG/xT weights → commit ONNX/JSON → thin TS inference) and the **streamer's own local broadcast-fidelity render** (WebGPU post-FX). A live residential-GPU producer stays OFF — redundant vs seed-broadcast, blows the quota, breaks determinism. Learned emergent agents stay a parked spike because they *fight* the authoritative scoreline. The 3060 (12GB, mature CUDA) beats the 5060 (8GB, bleeding-edge) — VRAM is the RL binding constraint.

The two guardrails that govern every bucket: **authority stays integer/seeded; cosmetics (bodies, curve, celebrations, audio, camera) stay float and one-way.** The `/subtests2` prototype already respects this — build outward from it, do not rewrite it.

## How to read this

- **[ROADMAP.md](ROADMAP.md)** — the master **3-bucket** roadmap (the centerpiece) + an adversarial reality-check.
- **[ARCHITECTURE.md](ARCHITECTURE.md)** — target architecture for each bucket + the cost ladder + the determinism guardrail spanning all three.

### Theme critiques (each bucket-tagged)

- [01 · match-realism](01-match-realism.md)
- [02 · predictions-data](02-predictions-data.md)
- [03 · visuals-audio](03-visuals-audio.md)
- [04 · infra-gpu-realtime](04-infra-gpu-realtime.md)
- [05 · game-loop](05-game-loop.md)
