## Recommended architecture for the advanced layer

### 1. The Python offline "factory" (name it, mirror `ball-tracker/`)
```
experiments/football-models/     # sibling of experiments/ball-tracker/
  pyproject.toml + uv.lock        # OWN venv/deps; app never imports this, this never imports app
  fit_dixon_coles.py              # scipy MLE + ridge shrinkage + time-decay  → team-strength.json
  fit_xg.py                       # statsmodels logistic on StatsBomb shots   → xg-coef.json
  bracket_mc.py                   # seeded 50k Monte-Carlo (optional precompute) → bracket-odds.json
  data/  (GITIGNORED)             # raw StatsBomb/FBref/ESPN — NEVER committed
  tests/ (pytest)                 # own gate, NOT wired to app tsc/lint/build
```
Invariant (already proven by ball-tracker): **heavy deps (torch/statsmodels/scipy/pandas) stay out of the Next bundle; the ONLY integration point is a compact committed artifact.** Every artifact carries a reproducibility header: `{ "schema":1, "generated_at":…, "git_sha":…, "data_through":"2026-06-29", "seed":42, "model":"dixon-coles-v1" }`, and the fit is seeded so re-runs are byte-identical (no noisy cron diffs). **Commit derived coefficients + synthetic samples only; raw third-party data stays gitignored** (CC-BY-NC / redistribution rule on a public, plausibly-commercial repo).

### 2. Artifacts → thin TS inference (the seam already exists)
```
public/models/team-strength.json   (~2–10 KB)  ─┐
public/models/xg-coef.json         (~<1 KB)     ├─ fetched as static assets over /baltfut basePath
public/models/bracket-odds.json    (~0.1–0.3 MB)┘
```
- `src/lib/ai-palpite/power.ts` + `predict.ts` **already are** the evaluator — swap the hand-typed `POWER`/`1.3`/`0.6` for the fitted JSON behind the SAME `teamPower()`/`predictScore()` signatures. TS math is a 9×9 Poisson PMF + DC τ (~30 lines, no deps).
- Precomputed probability *tables* are the sleeper win: the browser reads a number instead of evaluating `Math.exp`, **sidestepping the cross-engine float-determinism trap entirely** on the display side.

### 3. Re-fit loop: scheduled GitHub Action (NOT an Edge Function)
`.github/workflows/refit-models.yml` (weekly cron, copy an existing workflow). Runs the Python factory, regenerates `public/models/*.json`, commits → push-to-main auto-deploys Pages → live within a CI cycle. **Supabase Edge Functions are Deno and cannot run Python/scipy/statsmodels — do not reimplement the MLE in TS for no benefit.** Commit-to-repo (versioned/diffable) for once-a-day WC cadence; reserve Supabase Storage only for intra-match freshness that must change without a deploy.

### 4. Where the GPU sits: OFFLINE FACTORY, off when users visit
```
[RTX 3060 12GB, powered on only for a job]
   → trains RL policy / player-style embeddings (the ONLY GPU-worthy work)
   → exports ONNX (tens of KB) → committed artifact
   → browser infers via onnxruntime-web  (OR, better: GPU→Supabase Realtime producer)
```
- **Predictions never touch the GPU** (CPU-ms). The GPU earns its keep *only* on the RL/embedding path (B4) — which is a deferred spike.
- **No live GPU in any viewer's request path.** Determinism makes a live position-producer redundant (a 30-byte seed recomputes the match everywhere for free) and it detonates Supabase's 2M-msg/month quota (~15 msg/s ≈ monthly quota in ~36h; you'd have to batch to ~2 msg/s + client-interpolate — reintroducing the float-drift the seed avoided).
- **Streamer-only exception:** FastAPI behind a free Cloudflare Tunnel (token-gated) for the streamer's own control panel (trigger kickoff / re-run a Monte-Carlo). Single point of failure, acceptable *only* because the streamer is present — never a viewer feature.
- **Hardware: train on the 3060** (12 GB + mature CUDA 12.x + stable PyTorch wheels beat the 5060's 8 GB Blackwell + bleeding-edge toolchain; VRAM is the RL binding constraint). You never *serve* from either.

### 5. How the render + AI layers slot in without breaking determinism/authority
Two strict planes:
- **AUTHORITY plane (must be deterministic, integer, seeded):** `tournament.ts` scoreline/scorers/cards/bracket + `match-sim.ts`'s authoritative token positions. Utility-AI *selection* lives here → run it on **scaled-integer utilities + a 256-entry integer-exp LUT** (softmax without float `Math.exp`). Any calibrated λ that drives the *real* result samples from a **fixed-point CDF over integer λ·1000 with the seeded PRNG** — never `Math.exp` in authority. Watch-together broadcasts only the seed (+events) over the existing Realtime channel; every client recomputes identically.
- **COSMETIC plane (float-free, read-only, safe):** the render layer consumes the widened snapshot (`x,y,vx,vy,role,phase`) and decorates it — lean/bob, pixel sprites, Verlet/IK limbs (`Math.sin`/`sqrt`/lerp everywhere). **This plane MUST never feed a value back into the authority plane.** Two clients on the same seed get identically-positioned tokens but slightly different toe placement — undetectable, never desyncs. This separation is the single most important guardrail and is *why* Rain-World animation is safe here.
- **Substrate:** limbs force a Canvas2D migration off CSS-3D + per-frame React state (you cannot host 22 skeletons in React state) — the weeks-scale cost. Sprites can start on the existing `<div>`s; IK limbs require the canvas. GPU/WebGL is unnecessary for ~180 physics points.
- **Unsolved, route-independent:** rAF freezes in a hidden/occluded tab (no web fix) — don't sell "always alive."

### Cost verdict
- **Stays free ($0): everything on the critical path.** Static Pages + Supabase free tier + the Python factory on free GitHub Actions minutes + all client-side sim/AI/animation/sprite rendering. The marquee "IA vs você" prediction product, utility AI, synthetic multi-attrs, pixel sprites, and IK limbs are *all* $0.
- **GPU cost: electricity only,** and only if you build the deferred RL/embedding spike (B4). It trains and ships an ONNX artifact; it never serves. Pick the 3060.
- **Worth paying for (per V1, still true): at most ONE Cloudflare Worker (free–$5/mo) for scheduled kickoff + a Twitch bot** — NOT a VPS, NOT a live GPU host, NOT paid Supabase. Do not pre-commit even this until the loop proves out.
- **Never pay for:** a live residential-GPU producer (redundant vs seed-broadcast + risks paid Supabase message tier), a VPS, or onnxruntime-web multi-MB payloads shipped to a phone-heavy audience for marginal realism.
