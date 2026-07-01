# Spike v2 — advanced realism (Rain-World-style players, Python ML factory, GPU, retro visuals)

> Research spike v2 (2026-06-30). **Docs only — no code changed.** Companion to [../spike-subs-match-realism/](../spike-subs-match-realism/) (v1, unchanged). V2 critically evaluates a second AI's more ambitious proposals (procedural/IK animation + fully AI-controlled players like *Rain World*, a Python offline model 'factory' + ONNX, real-data calibration, using the owner's RTX 3060/5060, and retro pixel/3D visuals) against the actual code and the v1 conclusions.

## V2 Executive Summary — the advanced realism layer for baltfut /subtests

**The opportunity.** V1 proved the *foundation* (deterministic seeded sim, integer authority, seed-broadcast "watch together", stay free/static/Supabase). V2 asks how far realism can be pushed on top: Rain-World-grade players, a Python ML factory, real-data-calibrated matches, retro pixel/3D visuals. The honest answer is that **most of the advanced payoff is cheap, pure-TS or pure-CPU-Python, and needs neither a GPU nor a server — and the two most expensive, most-hyped ideas (RL self-play, true-3D rendering) are the *worst* realism-per-effort on the board.** The other AI's ROI *ranking* is broadly right; its *effort estimates* are optimistic by roughly one hardening/validation step each, and it repeatedly omits V1's determinism/authority guardrails.

**The single biggest insight: the two highest-value upgrades are already half-built in the repo, so they are S/M, not the "days" greenfield the other AI implies.**
- `src/lib/ai-palpite/predict.ts` **already is** the thin-TS artifact evaluator: `predictScore()` reads a `POWER` table (`power.ts`, `BASE_POWER=62`, ~60 hand-typed teams) and applies two magic constants (`home = 1.3 + gap*0.6`, `gap=(hp-ap)/18`). The Dixon-Coles "factory" is not new architecture — it is **replacing ~60 hand-guessed integers + 2 constants with a fitted `public/models/team-strength.json`** behind the same function shape. The seam is already cut.
- `match-sim.ts::decide()` **already is** a primitive utility function (it scores mates by `ahead*1.1 + defenderDist − carrierDist*0.25 + rnd`). Utility AI isn't a rewrite; it's finishing a job the code half-started in the one file that holds the brains.
- `experiments/ball-tracker/` **already is** the offline-factory pattern ("its own venv, the app never imports this"). `experiments/football-models/` is a sibling, not an invention.

**Verdict (a) — Rain-World players: split the ask, and the two halves have very different economics.**
- *Procedural physics animation* (Verlet torso + 2-bone analytic-IK legs with foot-planting gait + swinging arms): **feasible, $0, GPU-irrelevant** (180 points is trivial), and it delivers the "alive/has hands" quality. BUT the other AI's "a few days" hides the real cost: it **mandates a Canvas2D migration off today's CSS-3D + per-frame React-state tokens** (you cannot reconcile 22 limb-skeletons through React state) — the weeks-scale item V1 flagged. Foot-locking tuning alone (no ice-skating/moon-walking) is a full week. Honest total: **charming version ~1 week (after a canvas exists); convincing version 3–5 weeks.** The one free lunch: velocity/acceleration lean+bob on the *existing* tokens is hours and buys 60% of "physical" with zero architecture risk.
- *Emergent AI*: **Utility AI is the real win** (M, 3–5 days, pure TS, high ROI). **RL/MARL self-play is a research spike, not a feature** — the other AI's "weeks+" is off by an order of magnitude for *reliable* results, it fights the already-decided `tournament.ts` scoreline (smart AI that loses looks *broken*), and its float matmuls break cross-client seed-replay. Scope RL to off-ball motion only, if ever.

**Verdict (b) — Python offline factory: yes, adopt it, it is the backbone of the whole advanced layer.** Predictions (Dixon-Coles MLE + Elo + bracket Monte-Carlo) are **CPU-millisecond** laptop work, exported as ~2–10 KB JSON, re-fit by a **scheduled GitHub Action** (Supabase Edge Functions are Deno — they *cannot* run Python; kill that hedge). Two hard rules the other AI was breezy about: **(1) never commit scraped StatsBomb/FBref/Opta *data* to the public repo** (CC-BY-NC / redistribution violation on a plausibly-commercial, public repo whose backups are already GPG-encrypted *because* it's public) — commit only *derived coefficients* and *synthetic* samples; **(2) seed + manifest every artifact** so cron re-runs are byte-identical, not noisy diffs. Correct effort: DC fit is S–M *including regularization*, because WC-only data is ~2 games/team and a naive MLE overfits catastrophically without shrinkage + time-decay.

**Verdict (c) — the home GPU: mostly leave it off. Use it as an OFFLINE FACTORY only, and only for the RL/embedding path (which you probably shouldn't build).** The determinism keystone makes a live GPU producer *redundant* — a 30-byte seed lets every browser recompute the identical match for free; streaming positions replaces something you already have and quietly detonates Supabase's 2M-messages/month quota (~15 msg/s burns the monthly quota in ~36h). Predictions need **no GPU** (the product's marquee feature is a laptop job). A streamer-only FastAPI-behind-Cloudflare-Tunnel is fine for the streamer's own control panel (they're present anyway), never in a viewer's render path. **Hardware call: RTX 3060 12GB beats RTX 5060 8GB for the GPU's only real job (training) — VRAM is the binding constraint and Ampere+mature-CUDA beats Blackwell+bleeding-edge toolchain.** Bottom line: the GPU trains and ships an artifact; it never serves.

## How to read this

- **[ROADMAP.md](ROADMAP.md)** — prioritized advanced-realism roadmap, layered on v1, + an adversarial reality-check.
- **[ARCHITECTURE.md](ARCHITECTURE.md)** — the Python-factory → artifact → TS-inference pipeline, where the GPU sits, and the cost verdict.

### Deep-dives

- [01 · procedural-animation](01-procedural-animation.md)
- [02 · player-ai](02-player-ai.md)
- [03 · python-factory](03-python-factory.md)
- [04 · advanced-predictions](04-advanced-predictions.md)
- [05 · data-calibrated-sim](05-data-calibrated-sim.md)
- [06 · gpu-producer](06-gpu-producer.md)
- [07 · retro-visuals](07-retro-visuals.md)
