# Predictions, data & the "IA vs você" product — the definitive long game

## 1. What the code actually is (grounding the critique)

Two prediction paths coexist and neither is a model:

- **Main app (`ai-palpite`).** `power.ts` is a **hand-typed `POWER` table of ~60 team ratings** (FRA 91, ESP 90 … `BASE_POWER = 62`). `predict.ts::predictScore` turns a rating gap into a scoreline with two magic constants: `home = clamp(1.3 + gap·0.6)`, `away = clamp(1.3 − gap·0.6)`, `gap = (hp−ap)/18`, `confidence = |Δ|/30`. It is **fully deterministic, zero variance**, and the "AI pick" is just the rounded mean. `strongerCode` breaks knockout ties by raw power.
- **Subs sim (`tournament.ts::simulateMatch`).** Two **independent** Poissons, `λ = 0.35 + 2.4·(rating_share)` from XI average rating; scorers/minutes/cards/injuries/bracket-draw are all bare `Math.random()`; shootout is `0.7 + 0.25·share` per kick with a naive first-to-5-then-repeat loop.
- **Scoring (`votes/predictions.ts`, `results.ts`).** exact/can-win/losing classification only. **No proper scoring rule, no calibration anywhere.**

The single most important architectural fact — which V2's factory doc (`03-python-factory.md`) correctly caught and V1 underweighted — is that **`predict.ts`/`power.ts` is *already* a thin evaluator reading baked coefficients**. The coefficients are just hand-guessed. That means the entire "Python factory → commit JSON → thin TS inference" pattern is not a new system to build; it's a **swap of 60 integers + 2 constants for a fitted `public/models/team-strength.json`** read by the same-shaped functions. The seam is pre-cut. This collapses the headline effort estimate dramatically and is the anchor of the whole plan.

## 2. Critiquing v1 + v2

**What holds up (both spikes agree, correctly):**
- **Dixon-Coles / bivariate-Poisson is the right core model.** Independent Poisson (what `tournament.ts` does today) is systematically wrong on the low-score cells (0-0, 1-0, 0-1, 1-1) — exactly where draws and fairness live. The DC `τ(x,y,λ,μ,ρ)` correction is ~15 lines. Correct.
- **exp() link, not linear.** `λ = exp(μ + atk_home − def_away + γ)` replaces the arbitrary `0.35 + 2.4·share` / `1.3 + gap·0.6`. Correct and load-bearing — the linear ramp caps believable goal ratios.
- **Predictions need no GPU, no server.** V2's factory doc is emphatically right and V1 agrees: DC MLE is CPU-milliseconds; a 50k-sim bracket Monte-Carlo is a tight integer loop, sub-second in a Web Worker. **This entire theme is a laptop + static-JSON job.** GPU earns nothing here.
- **The artifact is tiny.** ~50 teams × 2 floats + 3 globals ≈ **1–2 KB**. A full 32×32 pairwise scoreline table is ~100–300 KB — a legitimate "browser does zero math, just a lookup" option that also sidesteps the float-determinism trap.
- **Licensing rule.** Both spikes converge: **commit derived coefficients, never raw StatsBomb/FBref/EA data** into a public repo. Fitted numbers aren't the copyrighted dataset. For the *predictions* layer this is largely moot (see below), but the rule stands for the sim-calibration layer.

**Where v1 is over-optimistic / under-scoped:**
- **"Dixon-Coles is a 30-line MLE, one afternoon."** The mechanics are ~40 lines, yes — but **World-Cup data is catastrophically thin: ~64 matches, 32 teams ≈ 2 games of signal per team.** A raw MLE overfits to one blowout and hands you garbage strengths. V1's `04-prediction-models.md` never says the word *shrinkage*. This is the biggest hole in v1. The fix is not more code, it's **regularization**: ridge-shrink each team toward the pool mean, **pool multiple competitions** (qualifiers, Nations League, continental cups, recent friendlies) with **Dixon-Coles exponential time-decay ξ**, and anchor on an **external prior** (Elo/SPI or market-implied strength) rather than fitting from WC results alone. Budget "an extra regularization + validation day," as v2's `04` correctly amends.
- **Home advantage.** v1 rightly flags `γ≈0` for neutral WC venues (keep a small edge only for hosts USA/MEX/CAN). Good catch; keep it.
- **Confidence.** Today's `|Δ|/30` is a decoration. v1's proposal to require a **probability triplet scored by RPS** (strictly proper) is the right long-game answer — it kills gaming because truthful reporting maximizes expected score.

**Where v2 is over-scoped / mis-ordered:**
- **PyMC hierarchical Bayesian "via scheduled Action."** v2's `04` is honest that this is *right but mis-ordered*: NUTS on 64 matches is overkill as a *first* step, adds sampler-tuning and divergence-debugging. But partial pooling is the **technically correct** answer to thin per-team data and the only honest way to put **credible intervals** on "chance to win the Copa." Verdict: **generation two**, not the foundation — but it *is* on the roadmap, unlike in v1.
- **ONNX-in-browser.** v2's factory doc is the sober voice: `onnxruntime-web` WASM runtime is **2–8 MB** before your model. For predictions you never need it — plain JSON + a 20-line TS Poisson/lookup evaluator. Correct; do not load onnxruntime for this theme, ever.

**Where the spikes disagree:**
- **Re-fit mechanism.** v1's `05` hedges between a GitHub Action and a Supabase Edge Function. v2's factory doc **kills the hedge correctly: Supabase Edge Functions are Deno — they cannot run Python/statsmodels/numpy.** The clean answer is a **scheduled GitHub Action (Python cron) that commits the JSON**; push-to-main auto-deploys Pages. This is Bucket A and it's right.
- **Data source for predictions.** v1's `05` frames StatsBomb as central and drags in the whole CC-BY-NC licensing minefield. v2's `04` makes the sharper point: **the predictions layer doesn't need StatsBomb at all.** A DC fit needs only `(home, away, hg, ag, date)` rows — **and `src/lib/team-history.ts` + `espn/standings.ts` already extract exactly that.** Match *results are facts, not copyrighted event data.* The StatsBomb/FBref licensing trap belongs to the **sim-calibration** layer (xG coefficients), not the prediction product. This distinction is the most valuable correction v2 makes and v1 blurs.

**What both are MISSING:**
1. **No calibration harness is treated as a deliverable, only as advice.** "Believable outcomes" is a *measurable* claim. Without a **reliability curve + RPS-vs-baseline backtest**, you cannot tell a good model from a decoration. This must be a first-class, permanent artifact — a `experiments/football-models/` gate that fails CI if RPS regresses below the naive baseline.
2. **The IA has no memory / no accountability loop.** The marquee "IA vs você" hook is that **the IA submits its argmax scoreline as a palpite into the same feed subs vote in** (`src/lib/votes/`) and gets scored by the same rules. Neither spike wires this concretely — but it's near-zero infra and it's the product. Beating the house line *is* the flex.
3. **Determinism seam for the authoritative path.** When DC `λ` eventually *drives* `simulateMatch`, `Math.exp` in the authority path re-enters V1's integer-authority landmine. Keep `Math.exp` on the **display** side; sample the authoritative goal count from a **fixed-point CDF over integer λ·1000 with a seeded PRNG**. Both spikes mention it; nobody sequences it.

## 3. The definitive long-game plan (ranked, bucket-tagged)

**Bucket A ($0 — the entire prediction product lives here).** Predictions are CPU-milliseconds; there is *no* honest reason for this theme to leave Bucket A. Every step below is A unless explicitly promoted.

**A1 — Fit a shrunk, time-decayed Dixon-Coles → `public/models/team-strength.json`; replace `power.ts` + `predict.ts` internals. [A]**
The cheapest high-impact step. Stand up `experiments/football-models/` as a sibling of `ball-tracker/` (own `uv` venv, own pytest gate, **zero coupling** to the app toolchain). Fit `atk/def` per team + `γ` + `ρ` via `scipy.optimize.minimize` on the bivariate-Poisson log-likelihood, **sum-to-zero constraint, ridge shrinkage toward pool mean, exponential time-decay ξ**, pooling qualifiers + continental + recent friendlies (all **results = facts**, sourced from the ESPN history already in `team-history.ts`). Ship a `{schema, generated_at, git_sha, data_through, seed, model}` manifest; seed the fit so re-runs are byte-identical. TS side: a ~30-line `cell(a,b,adv)` building the 9×9 scoreline matrix, `P(home/draw/away)` = sums, IA pick = argmax. **Why A:** no GPU (CPU-ms), no server, browser reads JSON. **Biggest trap:** skipping shrinkage and shipping an overfit fit on 64 matches.

**A2 — Calibration harness as a permanent, CI-gating artifact. [A]**
Backtest on held-out completed matches: **reliability curve** (predicted-P bucketed vs observed frequency, 45° = calibrated) + aggregate **RPS** (the correct metric for ordered H/D/A, per Constantinou & Fenton) and **Brier**, vs two baselines: naive "always 40/25/35" and, if obtainable, bookmaker-implied. Tune ρ, K, ξ, γ to **minimize RPS**. Wire it so a fit that fails to beat baseline **fails the factory's pytest gate**. **Why A:** offline Python script. **Non-negotiable** — it's what converts "plausible" into "measurably realistic."

**A3 — Proper scoring rule for the palpites game. [A]**
Replace exact/can/losing (`votes/predictions.ts`) with **tiered points** (exact = 5, correct goal-difference = 3, correct outcome = 1, wrong = 0, existing pen-winner = +0.5) for the legible leaderboard, **plus RPS** on an optional probability-triplet submission for the serious/"vs the IA" leaderboard. Rank by **average per match played** (latecomers not buried). **Never** confidence-as-multiplier (not proper, invites max-confidence spam); a per-round **"banker" double** is the fair middle ground. **Why A:** pure client math on `vote_entries` + finals. A nightly Edge Function materializing a `leaderboard` table is an optional A convenience, not required.

**A4 — Wire the IA as a competitor. [A]** The DC argmax scoreline is submitted as a palpite into the same `votes` feed and scored by A3's rules. Zero new infra; it's the "IA vs você" product made real.

**A5 — Monte-Carlo bracket → title odds + expected round. [A]** 20–50k seeded sims of the remaining bracket in a Web Worker (survives background-tab data-throttling per the memory notes), each tie drawn from A1's DC matrix. Output per-team P(champion)/P(final)/expected round — the single most impressive screen for the least effort once A1 exists. Replaces the `Math.random()` Fisher–Yates seed in `buildBracket` with power/Elo seeding.

**A6 — Elo/SPI power rating updating per real result. [A]** ~15 lines: `R' = R + K·G·(W−We)` with a margin-of-victory multiplier (FiveThirtyEight SPI style). Complements DC (fast, robust to thin data), gives narrative (an earned Cinderella run), and is the **external prior** A1 shrinks toward. Fits a scheduled Action or even in-TS.

**A7 — Weekly/after-matchday re-fit via scheduled GitHub Action. [A]** A Python-cron `refit-models.yml` regenerates `public/models/*.json` and commits; push-to-main auto-deploys. Predictions sharpen through the tournament with **no server in the request path**. Keep raw pooled data **gitignored**; commit only coefficients + manifest.

**A8 — Offline xG logistic model → ~6 JSON coefficients (sim-calibration, not prediction). [A]** `1/(1+exp(−z))` on StatsBomb shot distance/angle/header/open-play. **This is where the licensing rule bites:** fit locally, **commit only coefficients, never the StatsBomb JSON**, add attribution. Only earns its keep once A9 unifies sim + scoreline.

**A9 — Unify the cosmetic sim and the authoritative scoreline behind one DC/xG model. [A, sequence last in A]** Feed DC `λ` into `simulateMatch` so on-screen shots and the final score agree — but **only after** the sim is reworked to a seeded PRNG + fixed timestep + fixed-point positions (V1's keystone). This is the integer-authority landmine: sample from a fixed-point CDF, never float `Math.exp` in the authority path. Calibrating a still-non-deterministic float sim is wasted effort.

**A10 — Hierarchical Bayesian (PyMC) with credible intervals. [A, generation two]** Partial pooling is the *correct* fix for thin per-team data and the only honest way to band "chance to win the Copa." No GPU (64 matches, NUTS is fast). Do it **after A1–A7 prove the loop** — it's a refinement, not the foundation v2 implied.

**Bucket B (+ cheap server) — what it *does not* unlock here, honestly.**
A cheap server (Cloudflare Worker + Durable Objects, Fly/Hetzner) buys **kickoff scheduling, a Twitch bot/EventSub, a server-authoritative live loop, and freedom from Supabase's 7-day pause** — all valuable *elsewhere*, but the prediction/data product **needs none of it**. The only B-flavored prediction item: **sub-CI-cycle freshness** (intra-match Bayesian updates faster than a commit-and-deploy cycle) would move A7/A10's *output* from a committed JSON to a **Supabase Storage** artifact written by a small scheduled job — and even that is Storage (Bucket A) before it's a server. **Verdict: nothing in this theme genuinely requires B.** State it plainly so budget goes to the background-tab freeze and live loop, not to predictions.

**Bucket C (+ GPU) — where it helps: almost nowhere.**
Predictions, Elo/SPI, bracket Monte-Carlo, DC/xG MLE, and even PyMC NUTS are all **CPU-millisecond-to-second** jobs. The GPU (3060/5060) earns its keep **only** on the RL/embedding path — self-play agents, player-style embeddings — which V1 already parks because it *fights the authoritative scoreline* and V2 rates lowest product-ROI. If that path is ever pursued: **mode (i)** — GPU as an **offline producer**, training RL/embeddings on the home box and committing ONNX/JSON artifacts consumed by thin TS — is the sane one. **Mode (ii)** — shipping onnxruntime-web to every (phone-heavy) client for live inference — is a bad trade (2–8 MB runtime for marginal, non-deterministic realism). **Verdict: for this theme, GPU stays OFF.** The product's marquee feature is deliberately, provably a laptop job — and that's a strength, not a limitation.

## 4. The three things, if forced to pick

1. **A1** (shrunk, time-decayed Dixon-Coles → `team-strength.json`, dropped into the already-cut `ai-palpite` evaluator) + **A2** (RPS/reliability harness that gates it).
2. **A3 + A4** (proper tiered+RPS scoring, IA competing in the same feed) — turns the palpites toy into a fair, only-gameable-by-being-good competition.
3. **A5** (Monte-Carlo title race) — the "wow" screen, free once A1 exists.

All Bucket A, zero new hosting, no GPU. The correct posture for this theme is: **do it properly and thoroughly on the free stack** — the constraint was never infrastructure, it was the missing shrinkage and the missing calibration harness.
