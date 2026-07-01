# Match Realism V3 — The Master 3-Bucket Roadmap

This reorganizes all five themes (sim/physics/bodies/AI · predictions/data · visuals/audio · architecture/realtime/determinism · game-design/engagement) into three stacking buckets. Every item is tagged with **effort** (S=hours, M=days, L=weeks-months), its **dependencies**, and **what it unlocks**. Buckets stack: B includes A, C includes B.

---

## BUCKET A — $0 / current stack (GitHub Pages static + Supabase free + free GitHub Actions)

Bucket A carries the entire critical path. Nothing here needs money. Sequenced in dependency order.

### Phase A0 — The keystone (do these three before anything else)

**A0.1 — Seed the RNG in `tournament.ts` FIRST, then `match-sim.ts`.**
One `mulberry32` stream keyed on `bracketSeed` + per-match seeds, replacing all 11 `Math.random()` sites in `tournament.ts` (bracket `shuffle`, `poisson`, goal-minute `min()`, `pickWeighted` scorers/cards, `shootout`, `injuryLength`) and all 20 in `match-sim.ts`. TDD: same seed → identical `MatchResult[]` and identical bracket, then identical snapshots after N ticks.
· Effort **S** · Deps: none · **Unlocks: everything** — replays, watched-together, background-tab fast-forward, cross-client integrity, the unified xG model. *This is the hinge that keeps every other Bucket-A item free.*

**A0.2 — Fixed 1/30–1/60s timestep + accumulator; derive match minute from `Date.now()`.**
Decouple sim tick from render Hz; render interpolates. Kills frame-rate-dependent `dt` divergence and the *solo* tab-freeze immediately.
· Effort **S** · Deps: A0.1 · Unlocks: deterministic replay parity, catch-up.

**A0.3 — Web Worker sim on `setInterval`; main thread interpolates last two snapshots only when visible.**
Workers throttle less than `rAF` in a *backgrounded* (not occluded) tab. **Honesty rule:** this does NOT survive full OBS occlusion (project memory proves timers/workers/WSS/audio all freeze) — never sell a worker or crowd-bed as an occlusion fix; that mitigation is operational.
· Effort **M** · Deps: A0.1–A0.2 · Unlocks: robust background-tab data continuity.

**Determinism guardrail (permanent code-review gate for all of A):** Two planes. **Authority plane** (`tournament.ts`, authoritative positions, utility-AI *selection*) → seeded PRNG, scaled-integer utilities, a 256-entry integer-exp LUT for softmax, fixed-point CDF over `λ·1000`. **Never `Math.exp` in the authority path** (`poisson()` currently violates this). **Cosmetic plane** (lean/bob, sprites, IK limbs, curve, celebrations, audio, camera) → floats fine, read-only, must never write back.

### Phase A1 — Unify the two models (the root-problem fix)

**A1.1 — One shared xG/chance model unifying sim + scoreline.**
Build `xgOf(x,y,defendersInCone,keeperAngle)` (logistic on distance+angle, StatsBomb-style). Use it in `match-sim.decide()`'s shoot utility AND to *derive `tournament.ts`'s goals* — accumulate per-possession xG, sample goals from that instead of raw Poisson.
· Effort **M** · Deps: A0.1 · Unlocks: **dissolves the outcome-bias problem** (if the pitch generates the chances that generate the score, play and result agree by construction); scorelines cluster like real football (many 1-0/2-1, rare 6-0).

**A1.2 — Fit a shrunk, time-decayed Dixon-Coles → `public/models/team-strength.json`; replace `power.ts` + `predict.ts` internals.**
Stand up `experiments/football-models/` (sibling of `ball-tracker/`, own `uv` venv, own pytest gate, zero app-toolchain coupling). Fit `atk/def` per team + home-adv `γ` + low-score `ρ` via `scipy.optimize.minimize` on the bivariate-Poisson log-likelihood, with **sum-to-zero constraint, ridge shrinkage toward pool mean, exponential time-decay ξ**, pooling qualifiers + continental + recent friendlies (all *results = facts*, sourced from the ESPN history already in `team-history.ts`). Ship a `{schema, generated_at, git_sha, data_through, seed, model}` manifest; seed the fit so re-runs are byte-identical. TS: a ~30-line `cell(a,b,adv)` builds the 9×9 scoreline matrix; `P(H/D/A)` = sums; IA pick = argmax.
· Effort **M** · Deps: none (parallel to sim work); feeds A1.1's `λ` and A9 · **Biggest trap: skipping shrinkage on 64 matches.** Unlocks: a real model behind the "IA".

**A1.3 — Calibration harness as a permanent, CI-gating artifact.**
Backtest on held-out completed matches: **reliability curve** + aggregate **RPS** (correct metric for ordered H/D/A) + Brier, vs baselines (naive 40/25/35 and bookmaker-implied if obtainable). Tune ρ, K, ξ, γ to minimize RPS. A fit that fails to beat baseline **fails the factory's pytest gate**.
· Effort **S–M** · Deps: A1.2 · **Non-negotiable** — converts "plausible" into "measurably realistic."

### Phase A2 — On-field intelligence & physics

**A2.1 — Utility AI for the carrier** (integer-scored, softmax-via-integer-LUT selection).
Rewrite `decide()`'s coin-flip cascade into `scoreOptions()`: `shoot=xG`, `pass_i=openness − interceptRisk + xT-progression`, `dribble=space − pressure`, `cross=width×boxTargets`, `clear`. Add the **intercept-risk term the code lacks** (perpendicular distance of each opponent to the pass segment × closing velocity).
· Effort **M** · Deps: A0.1, A1.1 · Unlocks: "a team with a plan," legibly.

**A2.2 — Ball z-axis (`z`, `vz`, gravity, bounce) + Magnus curve.**
Passes stay z≈0; crosses/corners/goal-kicks/lofted through-balls launch with `vz`; headers connect only in a 1.7–2.4m head-zone; keepers claim high balls; a `spin` scalar bends free-kicks/finesse shots. Wire real `z` into the already-drawn (currently lying) shadow.
· Effort **M** · Deps: A0.1 · Unlocks: the single biggest *physics* believability jump; legible aerial play/headers/keeper's world.

**A2.3 — Sim→renderer animation-event channel (the missing seam).**
A cosmetic, read-only event queue: on `shoot`/`foul`/tackle-`giveBallTo`/header/goal the sim emits `{playerId, kind, dir, t}`. The body layer plays kick wind-up + follow-through, tackle lunge, header jump, ragdoll-on-foul (switch fouled skeleton to free Verlet ~0.8s, blend back), goal celebration. One-way only — never feeds back.
· Effort **M** · Deps: A0.1 · Unlocks: "he kicked it" vs "he jogged past it" — the prototype's bodies currently never interact with the ball.

**A2.4 — Off-ball utility + formation block with a line of engagement.**
Rewrite `target()` around three game-state scalars (defensive-line height, compactness, width); press only past a y-trigger, else hold a mid-block; feed live scoreline+progress in (trailing team late pushes up, leader shuts up shop).
· Effort **M** · Deps: A2.1 · Unlocks: teams that *look coordinated*; makes the coded offside trap visibly meaningful.

**A2.5 — Player kinematics: turning-radius clamp, reaction lag, attribute-split.**
Cap angular velocity-vector change in `steer()` (arc, overrun, cut-back); add per-player `reactionDelay` (80–250ms by rating); split `pace` into `topSpeed/acceleration/agility` so draft ratings are *visible*.
· Effort **S** · Deps: A0.1 · Unlocks: no more "hockey air-bots."

**A2.6 — Momentum-conserving jostling + shielding.**
Replace symmetric `separate()` with mass/strength-weighted contact along the normal; carrier shields by putting body between ball and challenger.
· Effort **M** · Deps: A0.1 · Unlocks: hold-up play & duels that read as football.

**A2.7 — Calibrated event-rate regression test.**
100-sim assertion: pass% 78–88%, shots 10–14/side, corners ~5, foul→card ratio in real bands. Guards A1–A2 from regression.
· Effort **S** · Deps: A2.1–A2.6 · Unlocks: safe iteration.

### Phase A3 — The prediction product ("IA vs você")

**A3.1 — Proper scoring rule for the palpites game.**
Tiered points (exact=5, correct GD=3, correct outcome=1, wrong=0, existing pen-winner=+0.5) for the legible leaderboard, **plus RPS** on an optional probability-triplet submission for the serious "vs the IA" board. Rank by average per match played. Never confidence-as-multiplier (not proper); a per-round "banker" double is the fair middle ground.
· Effort **S–M** · Deps: A1.2 · Unlocks: a competition only gameable by being good.

**A3.2 — Wire the IA as a competitor.**
The DC argmax scoreline is submitted as a palpite into the same `votes` feed and scored by A3.1's rules. Zero new infra; it's the "IA vs você" product made real.
· Effort **S** · Deps: A1.2, A3.1 · Unlocks: beating the house line as the flex.

**A3.3 — Monte-Carlo bracket → title odds + expected round.**
20–50k seeded sims of the remaining bracket in a Web Worker (survives background-tab data-throttling), each tie drawn from A1.2's DC matrix. Output per-team P(champion)/P(final)/expected round. Replace the `Math.random()` Fisher–Yates seed in `buildBracket` with power/Elo seeding.
· Effort **M** · Deps: A1.2, A0.1 · Unlocks: the single most impressive screen for the least effort.

**A3.4 — Elo/SPI power rating updating per real result.**
~15 lines: `R' = R + K·G·(W−We)` with margin-of-victory multiplier. Complements DC (fast, robust to thin data), gives narrative, and is the **external prior A1.2 shrinks toward**.
· Effort **S** · Deps: none · Unlocks: earned Cinderella runs.

**A3.5 — Weekly/after-matchday re-fit via scheduled GitHub Action.**
A Python-cron `refit-models.yml` regenerates `public/models/*.json` and commits; push-to-main auto-deploys. Raw pooled data stays gitignored; commit only coefficients + manifest.
· Effort **M** · Deps: A1.2 · Unlocks: predictions sharpen through the tournament with no server in the request path.

**A3.6 — Offline xG logistic model → ~6 JSON coefficients (sim-calibration).**
`1/(1+exp(−z))` on StatsBomb shot distance/angle/header/open-play. **Licensing rule bites here:** fit locally, **commit only coefficients, never the StatsBomb JSON**, add attribution.
· Effort **M** · Deps: A3.5 pipeline · Unlocks: the fitted `xgOf` for A1.1.

**A3.7 — Hierarchical Bayesian (PyMC) with credible intervals (generation two).**
Partial pooling is the *correct* fix for thin per-team data and the only honest way to band "chance to win the Copa." No GPU (64 matches, NUTS is fast). Do it **after A1.2–A3.5 prove the loop**.
· Effort **L** · Deps: A1.2, A1.3 · Unlocks: credible intervals on title odds.

### Phase A4 — Visuals, audio, broadcast immersion

**A4.1 — Widen `snapshot()` to `{x,y,vx,vy,role,id}` + a `phase` flag** (`dribble|pass|shot|loose`).
Cheapest high-impact visual step; unblocks every skin/audio layer identically; additive, tests stay green.
· Effort **S** · Deps: A0.1 · Unlocks: skins stop re-deriving semantics.

**A4.2 — Adopt `/subtests2` Canvas2D as the render baseline; retire the `/subtests` CSS-3D/React-state loop.**
The substrate is *already built* — a decision + cleanup, not the "weeks" migration V1 feared.
· Effort **S–M** · Deps: A4.1 · Unlocks: single-canvas, one-`draw()`/frame baseline.

**A4.3 — Camera + goal replay (`setTransform` + snapshot ring-buffer).**
Critically-damped camera eased toward the ball with velocity lookahead + dead-zone box (no 1:1 chase → nausea); a 3–4s ring-buffer enables cut-to-slow-mo replay on goal at 0.35× with a "REPLAY" bug — pure re-render of stored frames, no video.
· Effort **M** · Deps: A0.1, A4.1 · **The single biggest broadcast-feel gain and it's currently unbuilt.**

**A4.4 — Audio stack: Web Audio SFX + adaptive crowd + mix bus/ducking + master-mute.**
Single `AudioContext` gated behind the existing play button; one-shots (whistle/kick/net/post/tackle/roar, ~300KB CC0) on `phase`/`eventSeq`; crowd bed whose gain+low-pass track a smoothed `danger`; ducking (crowd under commentary) + master-mute/volume for streamers. Assets on Supabase Storage (still free tier).
· Effort **M** · Deps: A4.1 · Unlocks: highest immersion-per-KB.

**A4.5 — Templated pt-BR commentary + Web Speech voice tier.**
Phrase bank keyed by `kind × danger-bucket × context`, ≥6 variants/slot with recent-history dedupe, split play-by-play vs colour/idle-filler. `speechSynthesis` as the free voice. **Never an LLM/TTS on the live per-event path.**
· Effort **M** · Deps: A4.1 · Unlocks: variety+reactivity = 80% of "alive."

**A4.6 — Broadcast overlays** (corner radar/minimap, lower-third name bugs, possession arrow, LIVE/REPLAY bugs, ducked stat-pops).
Pure DOM/React over the canvas, zero per-frame cost.
· Effort **S–M** · Deps: A4.3 · Unlocks: broadcast polish.

**A4.7 — 2-bone IK gait hardening + kick/tackle/turn poses + set-piece variety; ragdoll on `foul()`.**
Foot-lift arc, cadence-vs-speed retuning across start/stop/turn, plant-slip prevention, plus explicit poses driven by A2.3's events, plus a goal-type library (header/tap-in/screamer/penalty/deflection) chosen by build-up and consistent with the authoritative scorer's role.
· Effort **L (weeks–months)** · Deps: A2.3, A4.2 · **The "convincing" both spikes under-priced.** Budget accordingly.

**A4.8 — Pixel-skinned IK limbs via PixelLab (LOD: 8-dir billboard far, skinned-IK near).**
Draw PixelLab limb sprites *along* the same IK bones — the Rain-World mesh-over-physics answer AND the retro-sprite answer *unified* as LOD tiers of one pipeline. Static PNGs in `public/`; PixelLab credits ≈ $0.
· Effort **L** · Deps: A4.2, A4.7 · Unlocks: retro-broadcast fidelity at scale.

### Phase A5 — Watched-together & the community loop

**A5.1 — Watched-together: broadcast `{bracketSeed, perMatchSeeds, startEpochMs}` (seed-only) over the existing Supabase Realtime channel.**
Clients recompute + fast-forward to `targetTick`. **Clock sync (the missing spec):** on join, ping a tiny Edge `now()` 3× and take the median RTT offset (Cristian's algorithm); sub-100ms suffices. **Catch-up cap (the missing spec):** if >3s behind, fast-forward the *simulation* but skip rendering intermediate frames; hard-cap the loop so it can't spiral. Reuses the shipped `reactions.tsx`/`page.tsx` broadcast pattern.
· Effort **M** · Deps: A0.1–A0.3 · Unlocks: "we're watching the same match" (same scoreline, same roar, ~1s apart), zero per-tick messages.

**A5.2 — Join-in-progress via one durable `match_state` row** `{match_id, bracket_seed, start_epoch, status}`.
Anon SELECT under existing RLS; because the sim is deterministic + clock-driven, no per-tick state is stored — the row + elapsed reconstructs the exact frame. **Grants tax:** every new table needs explicit grants to service_role + anon plus RLS plus `scripts/db/` assertions.
· Effort **M** · Deps: A5.1 · Unlocks: late arrivals see the live match.

**A5.3 — Persist teams/bracket/status to Supabase.**
Tables `subs_teams` (owner identity, roster JSONB), `subs_bracket`, `subs_status`; writes only through a `cast-vote`-style Edge Function; reads via `security_invoker` views.
· Effort **M** · Deps: A0.1 · **Identity is the retention primitive** — a team surviving a refresh is *the* emotional hook.

**A5.4 — Palpites tie-in, re-keyed to subs matches.**
Reuse `classifyPrediction`/`rankPredictions`; open a palpite window on the *fictional* match (scoreline + MVP + pen-winner). Re-key the cutoff from live ESPN scoreline to the subs match's `kickoff_at`; resolve against the **authoritative** `tournament.ts` integers, never the cosmetic sim. S-to-wire, M-to-integrate (not "verbatim").
· Effort **M** · Deps: A0.1, A5.3, A3.1 · Unlocks: fuses the two games into one economy.

**A5.5 — Presence spectator count + synchronized-kickoff lobby.**
"142 subs watching" + countdown to `kickoff_at`. **Caveat:** Presence churn burns the message quota; broadcast-only ephemera, no persisted emotes — a soft ceiling that eventually pushes to Bucket B.
· Effort **S–M** · Deps: A5.1 · Unlocks: the shared-event feel.

**A5.6 — Draft night as a live synchronized event.**
Same lobby-countdown + Presence + shared-clock treatment as a match. The missing "best watch-party of the season" — where identity is minted.
· Effort **M** · Deps: A5.1, A5.3 · Unlocks: the season's first appointment.

**A5.7 — Standings, awards & shareable clip cards.**
Golden Boot/Glove/MVP/biggest-upset over stored `MatchEvent[]`; static SVG→PNG card (`canvas.toDataURL`) subs drop in chat.
· Effort **S–M** · Deps: A5.3 · Unlocks: free viral acquisition surface.

**A5.8 — Rivalry/H2H + narrative layer.**
A `subs_h2h` record between *owners*; auto-tags "revenge match", "giant-killer", "cursed from the spot" from `MatchResult.events`; ticker lines feed the streamer's commentary.
· Effort **M** · Deps: A5.3 · **The owner-vs-owner grudge is the retention engine** both spikes assert but never build.

**A5.9 — Scheduled kickoff + bracket advance via `pg_cron` + Edge Function.**
Makes the tournament a real event even with no client open. **Honestly M, not S:** needs `pg_net` + vaulted key + idempotency (cron double-fires) + new-table grants/RLS/`scripts/db/` assertions.
· Effort **M** · Deps: A5.2 · Unlocks: appointment matches; markets/betting later.

**A5.10 — Season persistence: growth, transfers, dynasties.**
The carryover engine already exists and is TDD'd (`applyMatchEvents`/`advanceStatus` carry cards/suspensions/injuries incl. season-ending `"cup"`). Extend to a re-draft window, winner rating-bumps, retained-core rules, a dynasty badge. **Trap:** do NOT build before ≥1 full tournament has been *watched*.
· Effort **M** · Deps: A5.3, ≥1 watched season · Unlocks: dynasties.

**A5.11 — Progression sink / economy ladder.**
Spend palpites points on cosmetic kit hue-shifts, a one-time captain re-pick, a wildcard. A leaderboard with no sink plateaus.
· Effort **M** · Deps: A3.1, A5.3 · Unlocks: recurring decisions.

**A5.12 — Unify the cosmetic sim and authoritative scoreline behind one DC/xG model (sequence last in A).**
Feed DC `λ` into `simulateMatch` so on-screen shots and the final score agree — but **only after** A0.1–A0.2 (seeded PRNG + fixed timestep + fixed-point positions). Sample from a fixed-point CDF, never float `Math.exp` in the authority path. Calibrating a still-non-deterministic float sim is wasted effort.
· Effort **M–L** · Deps: A0.1–A0.2, A1.1, A1.2 · Unlocks: full play↔result agreement.

**A5.13 — Replays from `(seed, lineups, engineVersion)`; replay/schema versioning.**
Bytes per match; `engineVersion` pins old replays to old sim logic (the versioning gap both docs missed — a deployed sim change silently breaks in-flight replays otherwise).
· Effort **S–M** · Deps: A0.1 · Unlocks: durable replays across deploys.

---

## BUCKET B — + one cheap paid host ($2–25/mo)

Bucket A cannot do three things; each has a *different* cheapest answer — don't buy one box for all three. **Nothing on-field or in predictions needs B.**

**B1 — Twitch OAuth sub-gating + EventSub / Predictions bot.**
A static bundle *cannot* hold the broadcaster token or refresh it hourly, and EventSub needs a persistent WebSocket. Gate *owning a team*, not spectating.
· **Cheapest right option:** one Cloudflare Worker (free ~100k req/day → $5 Workers Paid) + a Durable Object for the EventSub socket + token cache. *Not a VPS.*
· Deps: A5.3 (team ownership), A5.9 · Unlocks: the first thing that genuinely breaks "$0"; sub-gated ownership + channel-point/bits betting.

**B2 — Channel-points / bits betting + live in-match prediction markets.**
A persistent EventSub bot opens a Twitch Prediction at kickoff and resolves it from the authoritative scoreline; "predict next scorer"/"HT result" via broadcast `{market_open, closesAt}`, collected through the cutoff-enforcing Edge Function. **Quick-win subset that stays in A:** a live MVP vote is just a Realtime broadcast tally, zero Twitch dependency — ship that in A first.
· Deps: B1, A5.4, A5.9 · Unlocks: streamer-native betting loop.

**B3 — Kill the 7-day pause / raise Realtime to 500 conns / more egress.**
The only tier that removes Supabase's idle-pause in one move. Buy it when a real stream makes Presence churn threaten the 2M-msg quota (A5.5's soft ceiling becoming hard).
· **Cheapest right option:** Supabase Pro $25/mo, zero ops.
· Deps: A5.1–A5.5 proving the loop · Unlocks: an "appointment" product that doesn't pause; headroom.

**B4 — Server-authoritative live loop (tamper-proof clock, live inputs, >200 spectators).**
The *only* scenario the deterministic client model can't cover — provably-identical match even against a tampering client, real-money-style integrity. Run the (now deterministic, A0.1) sim once server-side and broadcast state so an occluded tab re-syncs to a server clock instead of drifting. Here rapier2d-WASM's cross-platform determinism finally earns its weight (you still hand-roll ball-z). *Moves here from A: only the authority; the client body/cosmetic layer stays in A.*
· **Cheapest right option:** Cloudflare Durable Objects + WebSocket Hibernation (free ~3M req/mo, bills nothing while idle). Reach for Fly.io (~$2/mo) / Hetzner (€4) only if you ever need a persistent stateful Node game server.
· Deps: A0.1, A5.1 · Unlocks: integrity at scale; occlusion-proof re-sync.

**B5 — Scheduled kickoffs + heavier continuous fit.**
A cron on the cheap box drives scheduled tournament kickoffs and runs heavier periodic xG/xT re-fits than a free Action window allows. *(Scheduled kickoff otherwise stays in A via `pg_cron`; this is only for the heavier-compute or sub-CI-cycle-freshness case.)*
· Deps: A3.5 · Unlocks: intra-match Bayesian updates faster than commit-and-deploy.

**B-trap:** never host the kickoff path behind a cold start. Render/Railway scale-to-zero (~60s spin-up) is disqualifying for a "live match starting now" product. DO hibernation and Fly always-on avoid it.

**What stays in A / what moves to B:** scheduled kickoff **stays in A** (`pg_cron`). Twitch bot and the authoritative live loop are **born in B** (A physically can't). Pause-removal is a B *convenience* A can defer with a keep-alive ping until scale forces it.

---

## BUCKET C — + GPU (owner's RTX 3060 12GB; 5060 8GB secondary)

C is a research/factory tier. The 3060 (12GB, mature CUDA 12.x, stable PyTorch wheels) decisively beats the 5060 (8GB, bleeding-edge Blackwell) — **VRAM is the RL binding constraint** (replay buffers, parallel envs). You train on it; you never serve from it.

**C1 (mode i — GPU trains, commits artifacts, GPU then off) — the ONLY mode fully endorsed.**
Offline-train a small **imitation-learning off-ball movement policy** and/or better xG/xT weights; export int8 ONNX (tens of KB) / JSON; commit; ship static via the A3.5 Action pipeline; thin TS/onnxruntime-web inference. This is just A3.6 with a bigger model — no live GPU, no quota risk, no uptime concern.
· Deps: A3.5, A2.4 · **Unlocks what B cannot:** learned off-ball motion / better-fit weights that CPU-CI can't train.

**C1′ (mode i, ambitious) — MARL self-play → quantised ONNX, off-ball ONLY. PARKED SPIKE.**
Train PPO/MAPPO in a PettingZoo/Gymnasium football env (gfootball precedent); run 22 agents as one batched tensor/frame via onnxruntime-web. **Hard constraints:** (a) it **fights the authoritative scoreline** — scope strictly to off-ball runs/positioning, never shots/goals; (b) float matmuls **break cross-client determinism** unless int8-quantised *and* backend-pinned; (c) "looks weird before brilliant, often never brilliant." **Verdict: a research spike, not a roadmap item — utility AI (A2.1/A2.4) buys ~80% of "alive" for ~5% of the effort.**
· Deps: C1 infra · Unlocks: emergent behaviour (low ROI here).

**C2 (mode ii — streamer's GPU runs heavy things LIVE in the browser).**
WebGPU/onnxruntime-web for the *streamer's own* machine: full-screen post-FX (bloom, motion blur, CRT/palette-quantize "retro-3D pixelation" shader over the 2.5D scene), hundreds of sprites/particles at 60fps, or live cosmetic policy inference. **Tradeoffs:** needs a WebGPU-capable client (the streamer qualifies; phone viewers fall back to the A path); grows the bundle; **float matmuls detonate seed-replay unless int8+pinned**; must stay cosmetic/off-authority. Treat as a **broadcast-quality render mode**, not the shipped experience.
· Deps: A4.2, A4.8 · **Unlocks what B cannot:** a fidelity ceiling beyond the CPU Canvas2D budget — but only for the broadcaster's screen.

**C3 (mode ii — home GPU as offline asset factory).**
Higher-fidelity committed static assets: large recolorable sprite atlases, voxel-turntable-to-sprite bakes, baked pitch/stadium lighting, pre-rendered celebration cinematics. Commits PNGs/JSON; runtime stays A. Pure fidelity win, no uptime/quota risk.
· Deps: A4.8 · Unlocks: broadcast-grade assets with zero runtime GPU.

**C4 — Streamer-only token-gated FastAPI behind a free Cloudflare Tunnel (control panel).**
Acceptable *only* because the streamer is present anyway; a residential box in the request path is a hard SPOF. Never a viewer feature, never in a viewer's render path.
· Deps: B1 · Unlocks: the owner's hands-on control panel.

**REJECTED — C5: live GPU producer streaming positions → Supabase.** Redundant vs the $0 seed-broadcast (every client already recomputes the match), detonates the 2M-msg quota (~36h of one stream), and re-introduces the float-drift the seed avoids. Keep the GPU OFF as a live producer, always.

**Honest C summary:** the GPU's only justified roles are **offline artifact production (C1/C1′/C3)** and the **streamer's local broadcast render (C2)**. Emergent learned agents (C1′) stay a parked spike because they fight the authoritative scoreline. Deepest tradeoff: any float ML shipped to or across clients shatters the seed-replay invariant that makes the whole free architecture work.

---

## NORTH-STAR BUILD ORDER (single recommended end-to-end sequence)

The one long-game path, ordered by dependency then value. Cross-bucket dependencies are noted; you cross a bucket boundary only when the prior bucket physically can't deliver the next item.

1. **A0.1 seed `tournament.ts` → then `match-sim.ts`** — the hinge. Nothing is shared or replayable without it.
2. **A0.2 fixed timestep + `Date.now()` minute**, **A0.3 Worker sim** — deterministic, tab-freeze-resilient.
3. **A1.1 unified xG model + A1.2 shrunk Dixon-Coles `team-strength.json` + A1.3 RPS/reliability gate** — dissolves the two-model root problem *and* stands up the real "IA". (A1.2 runs in parallel from step 1.)
4. **A2.1 carrier utility AI → A2.2 ball z + Magnus → A2.3 sim→body animation events** — the biggest AI, physics, and "bodies touch the ball" gaps.
5. **A3.1 proper scoring + A3.2 IA competes + A3.3 Monte-Carlo title race** — turns the palpites toy into a fair competition and lights up the "wow" screen (free once A1.2 exists).
6. **A4.1 widen snapshot → A4.2 adopt Canvas2D baseline → A4.3 camera + goal replay → A4.4 audio → A4.5 commentary → A4.6 overlays** — the broadcast feel; camera+replay and audio are the real unbuilt wins.
7. **A5.1 seed-broadcast watch-together + A5.2 join-in-progress + A5.5 Presence lobby** — communal roar within ~1s, for $0.
8. **A5.3 persist teams + A5.4 palpites tie-in + A5.6 draft night + A5.7 award cards + A5.8 rivalries** — the retention loop: identity, shared stakes, narrative.
9. **A2.4–A2.7 off-ball block/kinematics/jostling + A5.9 `pg_cron` scheduled kickoff + A5.13 versioned replays** — a real 90 minutes that happens on schedule and replays across deploys.
10. **A4.7 gait-to-convincing + A4.8 pixel-skinned IK LOD + A3.6 xG coefficients + A5.12 unify sim↔scoreline + A3.7 PyMC** — the multi-month craft + generation-two refinements.
11. **[Cross to B — only when a real stream makes it load-bearing] B3 Supabase Pro (kill pause) → B1 Twitch OAuth/EventSub → B2 betting/markets → B4 authoritative loop (only if integrity/scale demands).**
12. **[Cross to C — research/factory] C1 GPU-trained off-ball/xG artifacts → C3 offline asset factory → C2 streamer-local WebGPU render; C1′ MARL stays a parked spike; C5 live producer rejected.**

Do **A0.1 before anything else.** It is the hinge that keeps all of Bucket A — the entire game, prediction product, and watch-together loop — free.

---

# Reality-check — adversarial feasibility critique (v3)

## V3 stress-test — verdict up front

I read the load-bearing code, not just the docs. **Every specific code claim in the V3 overview verifies exactly**, which is rare and worth stating plainly: 11 `Math.random()` sites in `tournament.ts`, 20 in `match-sim.ts`, the single authority-path float violation (`Math.exp(-lambda)` at `tournament.ts:100` inside `poisson()`), zero seeded PRNG anywhere in `src/`, `power.ts` is literally a hand-typed 60-team table on `BASE_POWER = 62`, `predict.ts` is two magic constants (`1.3 ± gap·0.6`), and the `/subtests2` substrate (`src/components/subs-draft2/pitch-view.tsx`) is exactly the claimed one-way cosmetic layer: single `<canvas>` 2D context, one rAF `frame()` calling `sim.step(dt)`→`sim.snapshot()`, velocity by finite difference (`(p.x - q.x) * invDt`, line 180) that is **never written back** into the sim, 2-bone IK gait, struck-ball kick detection, ragdoll on foul. So the plan is grounded, not hand-waved.

That said, the plan has real defects. Below are the ones that will actually bite, tiered by severity, with the fixed version.

---

## TIER 1 — will break as written (fix before building)

### 1. A0.1 is scoped as effort "S". It is not. It is the riskiest item in Bucket A.
The roadmap tags seeding both files as **S (hours)** and calls it "replace all `Math.random()` sites with `mulberry32`." Two of those 31 sites are *rejection-sampling loops with unbounded draw counts*:
- `poisson()` (`tournament.ts:99`) — `do { k++; p *= Math.random() } while (p > L)` consumes a *variable* number of PRNG draws per call.
- `shootout()` (`tournament.ts:120`) — `while (home === away)` loops indefinitely.

The moment you seed these, **every downstream consumer's RNG stream position depends on how many times the loop iterated upstream**. Change `poisson`'s λ by a hair (which A1.1/A5.12 explicitly do) and every subsequent scorer, card, and the entire bracket draw shift, because they're drawing from the same advanced stream. This is the classic seeded-RNG footgun the doc never names. **Fix:** partition the stream — a dedicated sub-stream per concern (`bracketRng`, and *per-match* `goalsRng`/`scorersRng`/`cardsRng`/`shootoutRng`, each `mulberry32(hash(matchSeed, "scorers"))`), so re-tuning λ can't reshuffle the bracket. Also replace Knuth-Poisson's `Math.exp`+multiply loop with the planned **fixed-point inverse-CDF** now, not "later in A5.12" — otherwise you seed it twice. Realistic effort: **M**, and it's TDD-heavy (determinism tests across the loop boundaries). This is the single most under-estimated item in the whole plan.

### 2. A0.3 "Web Worker sim" collides with the existing architecture, and the doc half-admits it.
`pitch-view.tsx` runs `createMatchSim` **on the main thread inside the rAF loop** and reads `sim.snapshot()` synchronously each frame (lines 131–132). Moving the sim into a Worker means the render thread no longer has a live sim object — it has *posted snapshots arriving on an interval*, and the finite-difference velocity (line 180, `invDt`) now has to be computed against **worker-tick dt, not frame dt**. Get that wrong and every IK gait cadence desyncs from apparent speed (ice-skating, the exact bug the code comments at line 321 fight). The doc lists A0.3 as "M, unlocks background-tab data continuity" but never flags that it *requires rewriting the snapshot-transport seam the whole cosmetic layer reads from*. And it correctly notes (honesty rule) workers **don't survive OBS occlusion** — but then A5.1's whole watch-together pitch leans on "refocused tab recomputes elapsed and fast-forwards," which only helps a *backgrounded* tab, not the streamer's *occluded* OBS source, which is the actual production scenario. **Net:** A0.3 is real but M-to-L once you count the transport rewrite, and it does **not** solve the streamer's occlusion problem it's implicitly sold against. Keep the sim on the main thread until watch-together (A5.1) actually needs the worker; don't do A0.3 speculatively at phase 0.

### 3. Float determinism across browsers is stated as a *cosmetic-only* risk. It is worse than that for watch-together.
The guardrail says authority stays integer so cross-browser float drift "only" hurts cosmetics. True for *positions*. But A5.1 broadcasts **seed-only** and every client *recomputes the match*, including `match-sim.ts`, which is saturated with `Math.hypot`/`Math.exp`/`rnd()`. Two viewers on V8 vs JSC will see the **same authoritative scoreline** (good, it's integer) but a **visibly different run of play** — different dribbles, different near-misses, a shot that rattles the post on one phone and doesn't on another. The doc's north-star literally promises "cosmetically the same goal, roar, and replay." **That promise is unachievable with client-side float recompute across heterogeneous browsers**, full stop. Either (a) downgrade the north-star to "same scoreline + same scripted goal moments, best-effort run-of-play," or (b) accept that true cosmetic sync needs the server-authoritative loop broadcasting *positions* — which is **Bucket B (B4), not A**. This is a mis-tiering: *pixel-identical* watch-together is a B capability the doc sells as an A one.

### 4. `pg_cron` scheduled kickoff (A5.9) cannot call an Edge Function on Supabase free without a piece the doc under-specifies.
The doc says A5.9 is "honestly M, needs `pg_net` + vaulted key + idempotency." Correct that it's M not S. But it under-states one thing: **`pg_net` availability and the `cron.schedule` → `net.http_post` → Edge Function chain is exactly the kind of thing that trips the "Automatically expose new tables OFF / zero default grants" gotcha in your own CLAUDE.md**, plus the Edge Function must be `verify_jwt`-compatible with a service call. This is doable on free, but it's the most likely item to eat a full day on grants/RLS/vault plumbing alone. Fine as A, just don't believe the M is a comfortable M.

---

## TIER 2 — mis-tiering and over/under-scoping

### 5. A4.7 (gait-to-"convincing") is correctly tagged L, but it's tagged L in the wrong bucket.
The doc admits IK-across-transitions is "weeks-months" and both prior spikes under-priced it — good, that's the most honest correction in V3. But look at what's *already in the code*: `stepGait` already handles kick sweep, ragdoll-on-foul, foot-plant re-aiming, stride-vs-speed. The *remaining* work (turns, stops, tackle/header poses, plant-slip) is genuinely open-ended polish with **diminishing broadcast return** on a top-down 2D pitch where players render ~12px tall. **This is the item most likely to consume months for a payoff nobody watching a stream will consciously notice.** It should be explicitly de-prioritized below audio/commentary/camera, which it *is* in the build order — but the roadmap should say out loud: *A4.7 is optional craft, not critical path, and may never be "done" — cap the investment.* Right now it reads as a milestone.

### 6. A1.3 "calibration gate fails CI if it doesn't beat baseline" is a determinism/flakiness trap.
Gating **push-to-main** on "model RPS beats naive baseline on held-out matches" sounds rigorous. With **~64 World Cup matches**, held-out RPS is *high variance* — a re-fit after one matchday can legitimately fail the gate on noise, and now your entire Pages deploy is red because of statistical variance in 2 games/team. **Fix:** the gate belongs in the *model factory* (`experiments/football-models/` pytest), and it should assert *non-degradation vs the committed model* + a *loose* baseline floor, never a tight "must beat naive every run" on tournament-thin data. Don't couple site deploy to a noisy metric.

### 7. B1 (Twitch OAuth/EventSub) — the Cloudflare Worker + Durable Object recommendation is right, but "free → $5" hides a real gotcha.
EventSub-over-WebSocket from a **Durable Object** is fine, but Twitch **also** offers webhook-transport EventSub, which a stateless Worker can handle *without* a persistent DO socket for many events — cheaper and simpler for sub-gating (you mostly need `channel.subscribe`/`subscription.end`, which webhook transport delivers fine). The doc reaches for the DO socket reflexively. **Reserve the DO for the live Predictions/betting bot (B2), use webhook EventSub for sub-gating (B1).** Also: the broadcaster **refresh token** must live in a secret store (Worker Secrets/DO storage) and *auto-refresh*; if it ever expires unrefreshed, sub-gating silently fails open or closed. That's the actual operational risk in B1, and it's unmentioned.

### 8. B4 "rapier2d-WASM finally earns its weight" — no. Don't introduce a physics engine here.
The server-authoritative loop (B4) proposes running "the now-deterministic sim once server-side" and name-drops rapier2d-WASM for cross-platform determinism. But your sim is a **~700-line rule-based TS engine**, not a rigid-body physics sim — rapier solves a problem you don't have (contacts/joints) and *doesn't* solve the one you do (your bespoke ball-z, passing FSM, offside logic). Bolting rapier on means **rewriting the whole sim in rapier's model** for determinism guarantees you can get more cheaply by running *your existing TS sim* under a fixed-point/integer discipline on the server (same code, same result, because it's the same code). rapier is a red herring that would balloon B4 from "run the existing engine on a DO" to "port the engine." **Cut rapier from the plan entirely.**

### 9. C1′ MARL and C2 WebGPU are correctly parked/cautioned, but C2's "phone viewers fall back to A" is a hidden fork-maintenance cost.
Every streamer-local WebGPU fidelity feature (C2) creates a **two-renderer problem**: the broadcaster sees the WebGPU render, phone viewers see the Canvas2D A-render, and now "we watched the same match" is *visibly false* at the cosmetic layer (see #3). This isn't just a fallback — it's a permanent divergence you must design around (e.g. WebGPU strictly as *post-FX over the same Canvas2D scene*, never a different scene). The doc says "cosmetic, off-authority" but doesn't flag that **two render paths = two things to keep in visual sync forever**. Constrain C2 to post-processing only, in writing.

---

## TIER 3 — smaller but real

- **A1.2 shrinkage is correctly flagged as the biggest gap** (this is genuinely V3's best catch over V1). But the doc says "anchor on an external Elo/SPI prior" *and* "A3.4 Elo is the prior A1.2 shrinks toward" — that's a **circular dependency the build order hides**: A1.2 (step 3) depends on A3.4 (step 5). Fix the order: Elo (A3.4, it's ~15 lines, no deps) moves **before** A1.2.
- **A3.6 xG from StatsBomb** — the licensing rule ("commit coefficients, never the JSON") is right, but StatsBomb's free data is **CC-BY-NC with an explicit attribution + non-commercial clause**. A subscriber game tied to a monetized Twitch channel is arguably *commercial*. Get this checked before fitting on it; the "coefficients only" dodge doesn't cure a non-commercial-use restriction on the *training* step. Consider Understat/public shot logs or synthetic geometry-based xG as a licence-clean fallback.
- **A5.10 season persistence "trap: don't build before ≥1 tournament watched"** — good discipline, keep it. Same discipline is *missing* from A5.11 (economy) and A4.7 (gait). Apply the "don't build before it's load-bearing" rule to those two as well.
- **`engineVersion` in the replay tuple (A5.13)** is a genuinely sharp catch both prior spikes missed. But it needs a partner the doc omits: **`modelsVersion`** (the `public/models/*.json` git sha). A replay recomputed after a model re-fit (A3.5) will produce a *different scoreline* even at the same `engineVersion`, because λ changed. Pin **both** the engine version and the model manifest sha in every replay/`match_state` row, or A3.5's weekly re-fit silently corrupts in-flight brackets — the exact failure `engineVersion` was introduced to prevent.

---

## Corrected build order (the fixes folded in)

1. **A3.4 Elo** (moved up — it's the prior everything shrinks toward, 15 lines, no deps).
2. **A0.1 seed `tournament.ts`** with *partitioned sub-streams* + fixed-point inverse-CDF Poisson (kill `Math.exp`) — **effort M, not S**, TDD across the rejection-loop boundary. *Then* seed `match-sim.ts`.
3. **A0.2 fixed timestep + `Date.now()` minute** (keep the sim on the **main thread** for now).
4. **A1.2 shrunk time-decayed Dixon-Coles** (now that Elo prior exists) + **A1.1 unified xG** + **A1.3 factory-side (not deploy-gating) RPS/non-degradation check**.
5. **A2.1 carrier utility AI → A2.2 ball-z → A2.3 sim→body event channel.**
6. **A3.1/A3.2/A3.3** prediction product + Monte-Carlo title race (the cheap "wow").
7. **A4.1 widen snapshot → A4.3 camera+replay → A4.4 audio → A4.5 commentary** (the real unbuilt broadcast wins; A4.2 is already effectively done in `pitch-view.tsx`).
8. **A0.3 Worker sim** — do it *here*, coupled to **A5.1 watch-together**, when the snapshot-transport rewrite actually pays for itself. Downgrade the north-star: **identical scoreline + scripted goal moments guaranteed; run-of-play best-effort** (cross-browser float makes pixel-identical impossible in A).
9. **A5.3/A5.4/A5.6/A5.8** retention loop; **A5.9 `pg_cron`** (budget a full day for grants/vault/`pg_net`); **A5.13 replays pinning BOTH `engineVersion` AND `modelsVersion`.**
10. **A4.7 gait polish + A4.8 pixel skins** — explicitly capped, optional, never critical path.
11. **Cross to B only when a real stream forces it:** B3 (kill pause) → **B1 via webhook EventSub** (DO only for B2's live betting bot) → **B4 running the *existing TS sim* on a Durable Object, no rapier.** Pixel-identical cosmetic watch-together lives here, not in A.
12. **Cross to C (factory only):** C1 offline off-ball/xG artifacts → C3 asset factory → C2 WebGPU **as post-FX over the same Canvas2D scene only.** C1′ MARL stays a parked spike; C5 live producer stays rejected.

## The one-line honest verdict
V3 is the strongest of the three spikes — its code claims are accurate, its shrinkage catch is the real fix V1 missed, its cosmetic/authority firewall is already law in the code, and its bucket philosophy (the marquee features are all $0) is correct. Its **three genuine errors** are: (1) A0.1 is an M not an S because of the rejection-sampling stream-position footgun, (2) *pixel-identical* watch-together is silently a Bucket-B capability (client float recompute can't do it), and (3) rapier2d in B4 is a red herring that would force a sim rewrite. Fix those three, move Elo before Dixon-Coles, pin `modelsVersion` alongside `engineVersion`, and the plan holds.

**Files that anchor this review:** `/Users/allan/www/personal/baltfut/.claude/worktrees/subtests-game/src/lib/subs-draft/tournament.ts` (auth plane; `poisson()` line 99–108 is the `Math.exp` violation + rejection loop), `/Users/allan/www/personal/baltfut/.claude/worktrees/subtests-game/src/lib/subs-draft/match-sim.ts` (cosmetic plane, 20 RNG sites), `/Users/allan/www/personal/baltfut/.claude/worktrees/subtests-game/src/components/subs-draft2/pitch-view.tsx` (one-way IK substrate; finite-diff velocity line 180, main-thread rAF+step lines 131–132), `/Users/allan/www/personal/baltfut/.claude/worktrees/subtests-game/src/lib/ai-palpite/{power.ts,predict.ts,simulate.ts}` (the pre-cut prediction seam), `/Users/allan/www/personal/baltfut/.claude/worktrees/subtests-game/src/lib/scoreboard-worker.ts` (existing `setInterval` worker precedent for A0.3).
