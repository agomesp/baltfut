## Advanced-realism roadmap (realism-per-effort first), layered on V1

**Legend:** Impact H/M/L · Effort S(hours–2d)/M(days)/L(1–3wk)/L+(weeks–months) · runs · ~$.
Every item assumes V1's foundation. **Hard V1 prerequisites** are called out inline.

> **V1 prerequisites this roadmap depends on (do these FIRST — they are V1 items, not V2):**
> **P0 — Seed the RNG** (one `mulberry32`/`xoshiro` stream) across BOTH `tournament.ts` (~10 `Math.random()`: Fisher–Yates line 53, `poisson`, scorer `min()`, cards) **and** `match-sim.ts` (~40 calls). *S, browser, $0.* Unlocks watch-together AND makes every artifact-driven result reproducible. **Nothing in V2 is safe without this.**
> **P1 — Integer/fixed-point authority + fixed 1/30s timestep** in `tournament.ts` + the sim's authoritative path (`Math.hypot`/`Math.exp` are not bit-identical across engines). *M–L, browser, $0.*

---

### QUICK WINS (do these first — highest realism-per-effort)

**Q1 — Dixon-Coles fit → `public/models/team-strength.json`, evaluated by the *existing* `ai-palpite/predict.ts`.**
Impact **H** · Effort **S–M** (2–4d incl. shrinkage; naive MLE alone is S but ships garbage) · runs: Python **offline/laptop, NO GPU** → static JSON; TS in browser · **$0**.
Technique: bivariate Poisson + Dixon-Coles τ low-score correction + sum-to-zero + **ridge shrinkage toward pool mean + exponential time-decay** (`scipy.optimize.minimize`, ~40 lines). Replaces `POWER`'s 60 hand-typed ints and the `1.3`/`0.6` constants. Train on `team-history.ts`/ESPN finished-match rows (results are factual — no licensing trap here). **This is the single cheapest high-impact advanced step; the biggest trap is skipping shrinkage on ~2-games/team WC data.**
*Depends on P0 (seed the bracket MC).*

**Q2 — Velocity/acceleration lean + squash/bob on the EXISTING token `<div>`s.**
Impact **M–H** (per-effort) · Effort **S** (hours) · runs: browser · **$0**.
Tilt each billboard opposite `accel=(v−vPrev)/dt`, add a run-cycle bob from `|v|`. No canvas, no architecture risk, instantly reads "alive." Pure cosmetic — never touches authority. **The free-lunch first animation step; do it before any canvas work.**

**Q3 — Widen `snapshot()` to emit `{x,y,vx,vy,role,id}` + a `phase` flag** (dribble/pass/shot/loose).
Impact **M** (enabler) · Effort **S** (hours) · runs: browser · **$0**.
Additive struct change; keep `match-sim.test.ts` green. Unblocks sprites, IK limbs, and utility-AI-driven intent *identically*. Cheapest enabler for the whole visual+AI layer.

**Q4 — Monte-Carlo the 32-team bracket (seeded) → per-team title odds + expected round.**
Impact **H** ("wow" screen) · Effort **S–M** (1–2d; reuse the existing Web-Worker pattern) · runs: browser Worker *or* precompute in Python → JSON · **$0**.
Draw each tie from Q1's DC matrix. 50k × 31 matches is sub-second in a Worker. Feeds a "chance to win a Copa" screen — most impressive screen per incremental effort once DC exists. *Depends on Q1 + P0.*

**Q5 — Utility-AI outcome-bias hook** (nudge the losing team's conversion utility down so play never contradicts `tournament.ts`).
Impact **H** (prevents "smart AI looks unjust/broken") · Effort **S** · runs: browser · **$0**.
Prerequisite guardrail for M1. V1's "unify play and result" applied to AI.

---

### MEDIUM BETS

**M1 — Utility AI for carrier + off-ball, integer-softmax selection.**
Impact **H** (dots→a team with a plan — the biggest visible sim jump) · Effort **M** (3–5d) · runs: browser, pure TS, no deps · **$0**.
Finish `decide()`'s half-built scoring. Add the terms it lacks: **static 12×8 Expected-Threat (xT) grid** (~96-float `Float32Array` constant — teams build toward goal), **intercept-risk** (min perpendicular distance to pass segment × closing velocity), **xG shot term** (logistic on dist+angle). Off-ball scores press/mark/run/hold-shape → gives `target()` real intent. **Determinism: run selection on scaled-integer utilities + a 256-entry integer-exp LUT for softmax** (P0/P1 rule applied to AI) so multi-client replay stays exact. *Depends on P0, P1, Q5.*

**M2 — Multi-attribute player vectors (SYNTHETIC), wired into the sim knobs.**
Impact **M–H** (a fast winger finally feels different from a solid CB) · Effort **M** (~1–2d, TDD the axis map) · runs: browser + one-off offline distribution-fit · **$0**.
Extend `Player`/`FieldSlot` to `{pace,shooting,passing,dribbling,defending,physical,stamina,gk}`; rewire ~20 call sites so each knob reads the *right* axis (`pace`→SPRINT term, `passing`→stray-chance/`acc`, `defending`→`TACKLE_RATE`, `stamina`→`stam` fatigue, `gk`→save roll). **NOT the "drop-in" the other AI claims** — the type change is trivial, the ~20-site rewire is the value. **Skip PCA** (latent axes don't map to named ones); map curated per-90 → axes by hand, position-normalize with a within-`cat` z-score. **Generate attrs synthetically** (sample from an offline-fit, position-conditioned distribution) — country-slot drafts have no real player identity, so this sidesteps the licensing minefield entirely.

**M3 — Canvas2D pitch layer mirroring the snapshot (dots only, no limbs).**
Impact **M** (enabler/de-risk) · Effort **M** (days) · runs: browser · **$0**.
The mandatory substrate migration V1 flagged. Draw the tilted pitch + 22 depth-scaled tokens on one canvas/one rAF, painter's-order by `y`, `image-rendering:pixelated` on an upscaled backing store. Keep the CSS-3D version until parity. **This is the real gate for all limb work.**

**M4 — Animated 2D pixel sprites via PixelLab 8-dir sheets.**
Impact **H** (best resemblance-per-effort; the ISS/Sensi/Kick-Off aesthetic) · Effort **M** (days for component + sheet packing; art gen is async PixelLab jobs) · runs: browser, art baked into `public/` · **$0** (PixelLab already owned).
Direction = `atan2(vy,vx)` bucketed to 8; frame = `floor(dist/stride)%n`; state from `phase`. Owner's `create_8_direction_object`/`animate_character` map 1:1; CC0 (Kenney/LPC) is the license-clean fallback. Perf-trivial for 22 tokens. Caveat: billboards don't foreshorten — that *is* the retro look. Can run on token `<div>`s (M4a, cheaper) or the M3 canvas (M4b, cleaner).

**M5 — Offline xG logistic model → ~6-coefficient JSON.**
Impact **M** (real shot quality; foundation for unifying sim+scoreline) · Effort **S** (an afternoon) · runs: GPU box offline (**GPU overkill — CPU ms**) → JSON; TS evals `1/(1+exp(−z))` · **$0**.
`statsmodels` logistic on StatsBomb-open shots (dist, angle, header, open-play). **Licensing: ship coefficients only, never the shot data.** Note: earns its keep only *after* M7 unifies sim+scoreline — bolted onto today's cosmetic-only sim it changes nothing viewers can verify.

**M6 — Weekly re-fit GitHub Action** committing the model JSONs.
Impact **M** (odds sharpen through the tournament, no server) · Effort **S** (copy an existing workflow; repo already has 5) · runs: GitHub Action (Python, cron) · **$0** (free CI).
Commit-to-repo (versioned, diffable) beats Supabase Storage for once-a-day WC cadence; reserve Storage for intra-match freshness. **Traps: gitignore raw data; seed + manifest (`{schema,generated_at,git_sha,data_through,seed,model}`) so runs are byte-identical.** *Wraps Q1/M5.*

---

### BIG BETS (defer; lower realism-per-effort)

**B1 — Verlet torso + 2-bone analytic-IK legs (foot-planting gait) + swinging arms + ragdoll-on-foul.**
Impact **H** (the true Rain-World "physical/has hands") · Effort **L** (3–5wk for convincing; ~1wk charming) · runs: browser Canvas · **$0**.
Law-of-cosines 2-bone legs (exact, cheap, determinism-friendlier than FABRIK/CCD — reserve those for 3-seg arms), stride ∝ speed, sine foot-lift, alternate by phase; lean from *acceleration*. Hook arm reach to `giveBallTo`/tackle + throw-in; ragdoll = free Verlet for ~0.8s on `foul()` then blend. **Body layer MUST stay 100% cosmetic/read-only — never feeds `match-sim.ts`/`tournament.ts`** (its floats are inherently non-reproducible; that's *why* it's safe). Budget a full week just tuning gait. *Depends on M3 (canvas). Optionally pixel-skin the bones via PixelLab (Rain-World "mesh over physics" trick).*

**B2 — Data-calibrated sim constants + unify cosmetic sim with the authoritative scoreline behind one xG/DC model.**
Impact **M** (play and result finally agree — the thing viewers can verify) · Effort **M–L** · runs: offline fit → JSON; browser · **$0**.
Retire the separate `poisson(0.35+2.4*ratio)` in `simulateMatch`; on-screen shots roll against M5's xG and drive the score. **Determinism landmine: this is where predictions meet the authority path — port to fixed-point seeded sampling over integer λ·1000, NEVER `Math.exp` in authority.** Pass/tackle/foul calibration is real but diminishing-returns (viewers won't notice 61% vs 65% pass completion) — backlog it. *Depends on P0, P1, M5.*

**B3 — Hierarchical Bayesian (PyMC) predictions with uncertainty bands.**
Impact **M** (honest credible intervals on title odds — partial pooling is the *correct* fix for thin per-team data) · Effort **M–L** (sampler tuning, divergence debugging) · runs: Python offline/Action, **NO GPU** (64 matches, NUTS is fast) · **$0**.
The technically-right answer to WC thin-data, but **mis-ordered by the other AI** — a penalized MLE (Q1) approximates it fine at this data volume. Gen-2 refinement, after Q1–M6 prove the loop.

**B4 — MARL / RL self-play → ONNX.**
Impact **L** (per-effort, for THIS product) · Effort **L+** (weeks–months, **high failure risk**) · runs: GPU-offline train (RTX **3060**) → onnxruntime-web OR (better) GPU-producer→Supabase Realtime · **$0 marginal, electricity**.
"True emergence" but: it *fights* the scripted scoreline, its float matmuls break seed-replay unless int8-quantized + backend-pinned, onnxruntime-web WASM runtime is 2–8 MB on a phone-heavy audience, and reward-shaping "looks weird before brilliant" and often never reaches brilliant. **Research spike, not a roadmap item; if pursued, scope to off-ball motion only.**

**B5 — True 3D (Three.js voxel + pixelation/palette post-shader).** Impact **L** · Effort **L (weeks+)** · **Park it.** The shader is a half-day; rigged glTF content + `InstancedSkinnedMesh` for 22 dominate, and it ships a multi-MB WebGL app inside a lightweight static bundle for a look B1+M4 already deliver at ~5% of the effort.

**B6 — One CSS `preserve-3d` voxel hero** for goal/celebration screens only (never 22). Impact **L** · Effort **S** · nice accent, near-zero match-view value.

---

### If you only do 3 advanced things
1. **Q1 — Dixon-Coles → `team-strength.json`** behind the existing `ai-palpite` evaluator. Earns the marquee "IA vs você" feature; S–M; $0; no GPU/server.
2. **M1 — Utility AI** (finishing `decide()`, integer-softmax, xT+intercept-risk+xG). Turns dots into a team with a plan; M; the biggest visible sim jump.
3. **Q2 + M4 — velocity lean/bob now, then PixelLab 8-dir sprites.** Best realism-per-effort on visuals; hours→days; hits the retro target with owner-owned tooling.

### Suggested overall sequence (merging V1 + V2)
**P0 seed RNG → P1 integer authority/fixed timestep** (V1 keystone) **→ Q1 DC fit → Q4 bracket MC → Q3 widen snapshot → Q2 lean/bob → Q5 outcome-bias → M1 utility AI → M2 synthetic multi-attrs → M6 re-fit Action (wrapping Q1/M5) → M3 Canvas2D → M4 pixel sprites → M5 xG → B2 unify sim+scoreline → B1 IK limbs → (B3 PyMC / B4 RL as optional spikes).**
Rationale: determinism first (unlocks everything + watch-together for free), then the product feature (predictions), then the sim brains, then the substrate migration, then the body/visuals, with RL/3D parked.

---

# Reality-check — adversarial feasibility critique (v2)

# V2 Adversarial reality-check — verified against the actual `/subtests` code

I read the four files the plan stakes its claims on (`ai-palpite/predict.ts`, `power.ts`, `subs-draft/tournament.ts`, `subs-draft/match-sim.ts`) plus the render layer (`components/subs-draft/pitch-view.tsx`). Bottom line: **the plan's architectural claims are accurate — the two "seams already cut" are real, and the render-layer bottleneck it warns about is real.** But several effort estimates are still soft, one factual count is wrong, and a couple of the second AI's framings survive into V2 unchallenged. Blunt breakdown below.

## What checks out (so I'm not just crying wolf)
- **Q1 seam is real.** `predict.ts::predictScore` (lines 22-29) literally is `home = clampGoals(1.3 + gap*0.6)` with `gap=(hp-ap)/18`, and `power.ts` is exactly ~60 hand-typed ints + `BASE_POWER=62`. Swapping in a fitted `team-strength.json` behind `teamPower()`/`predictScore()` is genuinely additive. **Confirmed.**
- **M1 seam is real.** `decide()` at `match-sim.ts:307` is a primitive utility function — line 361 scores mates by `ahead*1.1 + defenderDist − carrierDist*0.25 + rnd(0,6)`. Utility AI is finishing this, not a rewrite. **Confirmed.**
- **Q3 is truly additive and cheaper than sold.** The internal `P` type (lines 51-54) *already carries* `vx, vy, ax, ay`. `snapshot()` (654-670) just drops them, emitting `{x,y}`. Widening it is hours, and the velocity data the whole animation layer needs already exists. **Confirmed, and if anything under-sold.**
- **The float-authority risk is real and 100% unaddressed.** Positions are all `number` (float), `dist = Math.hypot(...)` (line 72), the sim has **zero** integer/fixed-point math and **zero** rounding in its authority path. `poisson()` in `tournament.ts` uses `Math.exp` (line 100). V1's P0/P1 keystone is not optional — it's load-bearing for everything downstream. **Confirmed.**
- **The canvas-migration cost (M3/B1) is real, not FUD.** `pitch-view.tsx` drives **~14 `useState` setters per rAF frame** from `sim.snapshot()` (lines 46-56, 88-122). It's genuinely CSS-3D: `perspective:760` + `rotateX(TILT)` + `preserve-3d` (167-168), counter-rotated billboards (252), `depthScale` (244). You cannot host 22 limb-skeletons in React state through this path. The plan is right that IK limbs force a Canvas2D rewrite — **weeks, not days.** Confirmed.
- **The offline-factory precedent is real.** `ball-tracker` exists as a TDD'd, venv-isolated CV spike on a feature branch. `football-models/` as a sibling is a credible pattern, not an invention.

## Corrections & over-optimism to flag

**(1) Factual error: the Math.random count in `match-sim.ts` is 20, not "~40".** The plan (P0) says "~40 calls." Actual `grep -c` = **20** in `match-sim.ts`, **11** in `tournament.ts` (plan says "~10", fine). This *helps* the plan — seeding P0 is smaller than advertised (~31 call sites total, not ~50) — but a plan that miscounts the thing it calls the keystone deserves a skeptical read on its other "~" numbers.

**(2) Q1 "S–M / 2–4d" — the honest number is M, and the shrinkage caveat is the whole ballgame.** The plan already says the trap is skipping shrinkage on ~2-games/team WC data — correct — but then still labels it S–M. For a *national-team* WC bracket there is barely any head-to-head history; a naive Dixon-Coles MLE on 2 fixtures/team doesn't just "ship garbage," it fails to identify. You need ridge/hierarchical shrinkage toward a pool mean AND a prior from continental-qualifier or Elo/SPI data, plus time-decay. That's the actual work, and it's M, closer to 4d than 2. The 30-line MLE the second AI promised is the easy 20%.

**(3) Q1 has a licensing subtlety the plan waves through.** The plan says "train on ESPN finished-match rows... results are factual — no licensing trap." Match *results/scores* are facts (uncopyrightable) — fine. But the moment you enrich with **per-90 metrics, xG, or event data (M2/M5) from StatsBomb/FBref/Opta**, you're in CC-BY-NC / redistribution territory on a *public, plausibly-commercial* repo. The plan gets this right for M2/M5 (ship coefficients only, synthetic samples) but should not let Q1's "no trap" bleed into "data enrichment is fine." Keep the line bright: **facts in, third-party derived metrics never committed.**

**(4) B1 "charming ~1wk / convincing 3–5wk" — the convincing end is optimistic; budget 4–6wk and gate it behind M3 being *done and at parity*.** Foot-locking (no ice-skating) on a sim whose positions were never designed for gait extraction is the classic time sink — you'll be inferring stride phase from `|v|` on tokens that teleport during passes/set-pieces (the sim hard-sets `ball.x/vx` in `distribute`, `doCross`, goal-scripting at line 647-650). Discontinuous velocity = broken gait unless you smooth, and smoothing the *cosmetic* layer is fine but adds tuning weeks. The plan's own "budget a full week just tuning gait" is the honest part; the "1wk charming" assumes the canvas already exists AND the snapshot is already widened. Stack the real dependency chain: **P0→P1→Q3→M3(to parity)→B1**, and B1 alone is a month.

**(5) B4 (RL self-play) — the plan mostly kills it, correctly, but should kill it harder.** It's not just "research spike, high failure risk." For *this* product it is architecturally self-defeating: the scoreline is authoritative in `tournament.ts` (Poisson from XI avg-rating, line 136), so a genuinely-smart learned agent that plays well but *loses because the dice said so* looks **broken**, not realistic — worse than the current dumb FSM. Q5's outcome-bias hook is a band-aid that fights the RL policy. And float matmuls in onnxruntime-web break cross-client seed-replay unless int8-quantized + backend-pinned (WASM vs WebGPU produce different bits). Verdict: **not a roadmap item at any tier.** If the itch must be scratched, off-ball motion only, and accept it never touches the result.

**(6) The GPU-in-the-loop patterns (ii)/(iii) are correctly rejected, and the quota math is the killer argument — keep it front and center.** Streaming 22 positions at 10-15Hz "is tiny" per-message but detonates Supabase free tier (2M msgs/mo ≈ exhausted in ~36h at 15 msg/s). The determinism keystone makes it *redundant anyway*: broadcast the 30-byte seed, every client recomputes. The plan nails this. The only correct GPU use is offline artifact export, and the only artifact worth a GPU is the RL/embedding path you shouldn't build — so in practice **the GPU stays off.** Hardware call (3060 12GB > 5060 8GB, VRAM-bound, mature CUDA) is right but nearly moot given how little GPU work survives scrutiny.

**(7) "Supabase Edge Functions can't run Python" — correct and worth repeating.** They're Deno. The second AI's hedge ("scheduled GitHub Action *or* Edge Function") is dead on arrival for the Python factory. Scheduled GitHub Action committing `public/models/*.json` is the only sane re-fit loop. The plan already says this; don't let the Deno option resurface.

## Determinism guardrail the plan states but must enforce in code review
Two planes, and the seam between them is where bugs will hide:
- **Authority plane** (`tournament.ts` + sim's authoritative positions): must go integer/fixed-point + seeded PRNG. Utility-AI *selection* lives here → scaled-integer utilities + integer-exp LUT for softmax, never `Math.exp`. Any calibrated λ (B2) samples from a fixed-point CDF over `λ·1000`, never `Math.exp` in the authority path (which `poisson()` currently violates).
- **Cosmetic plane** (render/lean/sprites/IK): float-free-*optional*, read-only, must **never** write back. Two clients on one seed get identical token positions but different toe placement — undetectable, never desyncs. This is *why* Rain-World animation is safe. The single rule that keeps the whole thing sound: **the body layer never feeds `match-sim.ts` or `tournament.ts`.**

## Corrected priority order
The plan's order is basically right; I'd tighten it:

1. **P0 — seed the RNG** (now known to be ~31 call sites, not ~50). Unlocks watch-together + reproducibility. Nothing is safe without it.
2. **P1 — integer authority + fixed 1/30s timestep** (replace `Math.hypot`/`Math.exp` in the authority path).
3. **Q1 — Dixon-Coles → `team-strength.json`** behind existing `predict.ts`. Marquee "IA vs você." Budget **M with shrinkage + external prior**, not S.
4. **Q4 — seeded bracket Monte-Carlo** → title odds screen (needs Q1).
5. **Q3 — widen `snapshot()`** to `{x,y,vx,vy,role,phase}` (hours; data already exists).
6. **Q2 — velocity lean/bob on existing divs** (the free lunch; do before any canvas).
7. **Q5 — outcome-bias hook** (guardrail so smart AI never contradicts the scoreline).
8. **M1 — utility AI** (finish `decide()`; integer-softmax). Biggest visible sim jump.
9. **M2 — synthetic multi-attrs** (NOT drop-in; the ~20-site rewire is the value; skip PCA).
10. **M6 — re-fit GitHub Action** (Python; commit JSON; seed+manifest artifacts).
11. **M3 — Canvas2D substrate** (the real gate; take it to parity before limbs).
12. **M4 — PixelLab 8-dir sprites** (best resemblance-per-effort; owner already owns the tool).
13. **M5 — xG coefficients** (afternoon, but only *visible* after B2).
14. **B2 — unify cosmetic sim + authoritative scoreline** (fixed-point sampling; the thing viewers can verify).
15. **B1 — Verlet+IK limbs** (a month; strictly after M3 at parity).
16. **Parked indefinitely: B3 (PyMC — MLE+shrinkage approximates it at this data volume), B4 (RL — self-defeating vs scripted result), B5 (true 3D — multi-MB for a look B1+M4 already give).**

## If you only trust three things
1. **Q1** — the marquee feature, seam already cut, $0, no GPU/server (just don't skimp on shrinkage).
2. **M1** — dots→a team with a plan, pure TS, finishing half-written code.
3. **Q2 then M4** — lean/bob now, PixelLab sprites next; best realism-per-effort, owner-owned tooling, no canvas needed for M4a.

Everything on the critical path stays **$0 / static / Supabase-free-tier**. The GPU trains an artifact you probably won't build; it never serves. The one paid thing worth pre-committing to remains a single Cloudflare Worker (free–$5/mo) for scheduled kickoff + Twitch bot — and only after the loop proves out.
