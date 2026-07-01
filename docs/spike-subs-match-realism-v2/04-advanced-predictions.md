# Advanced prediction models — the "IA vs você" product

## What the code actually gives you to work with

The outcome authority is small and legible. In `tournament.ts::simulateMatch`, goals are `poisson(0.35 + 2.4 * strengthShare)` where `strengthShare = avgRating(homeXI) / (sh+sa)` — a **single-scalar** attack/defense proxy (ratings 70–93 in `data.ts`, `mockSquad`, `buildPool`). Scorers, minutes, cards, injuries, and the shootout are all bare `Math.random()`. `buildBracket` seeds via a `Math.random()` Fisher–Yates. So the "model" today is one Poisson mean per side with no team identity beyond an averaged rating. That's the thing to replace.

Crucially, the raw material for a *real* model is already in the repo: `src/lib/team-history.ts::teamCupHistory` and `src/lib/espn/standings.ts` extract finished-match `homeScore`/`awayScore` per team from ESPN. A Dixon-Coles fit needs exactly that — a list of `(home, away, hg, ag, date)` rows. You do not need to scrape or vendor StatsBomb/FIFA data for the *predictions* layer (V1's licensing trap applies to the *sim-calibration* layer, not here). WC history is thin (each nation plays ~3–7 games), which is the real constraint and shapes every recommendation below.

## Grading the second AI's claims

**"Dixon-Coles is a ~30-line MLE, days of work, huge payoff."** The payoff framing is right and the effort is *roughly* right — but with two honest caveats the other AI glossed.

1. **The 30-line MLE is real but naive.** Poisson attack/defense/home-advantage MLE is genuinely ~40 lines of `scipy.optimize.minimize` over a log-likelihood with a sum-to-zero identifiability constraint. The Dixon-Coles part is a `τ(x,y,λ,μ,ρ)` low-score correction that nudges only the (0,0),(0,1),(1,0),(1,1) cells — another ~15 lines. That much is honest. What's *not* trivial: **with WC-only data you have ~64 matches per tournament and 32 teams — that's ~2 games of signal per team, which will overfit catastrophically.** A raw MLE will hand you strength estimates dominated by one blowout. The fix is not more code, it's a **prior/shrinkage** (regularize each team's strength toward a pool mean, or pool multiple competitions with time-decay). So "days of work" is true for the *mechanics* and optimistic for a model that isn't garbage. Budget the extra day for regularization + validation.

2. **"Export ~50 team coefficients, TS just evaluates a Poisson PMF (trivial)."** Correct and the best part of the proposal. The artifact is tiny and the browser math is genuinely cheap. This is the keystone insight and it holds.

**"Live Bayesian update (PyMC hierarchical) via scheduled GitHub Action."** Right idea, over-scoped as a *first* step. PyMC/NUTS on 64 matches is overkill and adds a heavy Python dep, sampler-tuning, and divergence-debugging for a posterior that a penalized MLE approximates fine at this data volume. It becomes worth it *only* once you want honest **uncertainty bands** on "chance to win the Copa" (partial pooling shines exactly when per-team data is thin — which is your case). So: not first, but a legitimate *second-generation* upgrade, and the hierarchical structure is the technically correct answer to the thin-data problem. Grade: valuable, mis-ordered.

## The artifact shape (concrete)

Offline Python → one JSON baked into the static bundle (or written to Supabase Storage by a scheduled Action):

```json
{
  "fitDate": "2026-06-30", "homeAdv": 0.28, "rho": -0.09,
  "teams": { "BRA": {"atk": 0.42, "def": -0.31}, "ARG": {"atk": 0.38, "def": -0.22}, ... }
}
```

~50 codes × 2 floats + 3 globals ≈ **1–2 KB**. TS inference (fits the existing `@/lib` shape, ~30 lines, no deps):

```ts
const cell = (a:TeamCoef,b:TeamCoef,adv:number) => {
  const lh = Math.exp(a.atk + b.def + adv);   // home λ
  const la = Math.exp(b.atk + a.def);         // away μ
  const pmf = (l:number,k:number)=> Math.exp(-l)*l**k/fact(k);
  const M:number[][]=[];
  for (let x=0;x<=8;x++){ M[x]=[]; for(let y=0;y<=8;y++)
    M[x][y] = pmf(lh,x)*pmf(la,y)*tau(x,y,lh,la,rho); }
  return M; // 9×9 scoreline-probability matrix
};
// P(home), P(draw), P(away) = sum over x>y, x==y, x<y
// IA pick = argmax cell → "BRA 2–1"
```

**Determinism watch (V1 keystone):** this matrix is for *display* — read-only, recomputed identically nowhere-sensitive, so float non-determinism across engines is harmless here. But the moment you let these λ drive the *authoritative* Poisson draw in `simulateMatch`, you re-enter V1's integer-authority rule: sample from a **fixed-point CDF over integer λ·1000** with a seeded PRNG, never `Math.exp` in the authority path. Keep `Math.exp` on the cosmetic/display side only.

## The product layer

- **Match card:** "BRA 55% / empate 24% / ARG 21%" + modal scoreline heatmap + IA's argmax pick. This *is* the "IA vs você" hook — the IA submits the argmax scoreline as a palpite into the exact same feed real subs vote in (`src/lib/votes/`), and gets scored by the same rules. Zero new infra; it's just another entry.
- **Power ranking:** sort teams by `atk − def` (a net-strength scalar) → a live "força" table. Feeds naturally into the mata-mata seeding, replacing the `Math.random()` shuffle in `buildBracket`.
- **"Chance to win a Copa":** Monte-Carlo the bracket 20–50k times in the browser (each sim: draw every tie from the DC matrix, advance winners). 50k × 31 matches × cheap PMF ≈ well under a second in a Web Worker (reuse the existing worker pattern from the background-throttling memory). Output: per-team title odds + expected round. This is the single most *impressive* screen for the least incremental effort once DC exists.

## Calibration / validation (don't skip — it's what makes it "genuine")

Backtest on held-out WC matches with **Ranked Probability Score** (RPS — the standard for ordered 1/X/2 outcomes, better than Brier here) and a **reliability curve** (bin predicted-prob vs realized frequency). Compare against two baselines: bookmaker-implied odds (if you can get any) and the naive current avg-rating model. If your DC RPS doesn't beat "always 40/25/35," the fit is broken. This is ~half a day in Python and it's the difference between a model and a decoration.

## Ranked recommendations

1. **Dixon-Coles fit → JSON coefficients + TS PMF evaluator + match-card odds.** *Why:* turns the fake avg-rating Poisson into a genuine, explainable "BRA 55%" — the actual product. *Effort:* **M** (2–4 days incl. regularization; the naive MLE alone is S but ships garbage on thin data). *Runs:* Python **offline** (your box, CPU-ms, **no GPU**) → static JSON; TS in **browser**. *Cost:* **$0**. *Libs:* `scipy.optimize`, `numpy`; algorithm = DC bivariate Poisson w/ τ low-score correction + sum-to-zero + ridge shrinkage + exponential **time-decay** (Dixon-Coles' own ξ weighting). **This is the cheapest high-impact first step — and the biggest trap is skipping the shrinkage and shipping an overfit fit.**
2. **Monte-Carlo bracket → title odds + expected round.** *Why:* the "wow" screen; per-team chance-to-win the Copa. *Effort:* **S–M** (1–2 days; reuse worker). *Runs:* **browser** Web Worker (or precompute in Python and ship a JSON table). *Cost:* **$0**. Depends on #1's matrix.
3. **Elo/SPI power rating updated per real result → seeding + a live força table.** *Why:* a running, legible strength number that updates as WC results land and replaces the `Math.random()` bracket seed. *Effort:* **S** (Elo is ~15 lines; K-factor + margin-of-victory multiplier à la FiveThirtyEight SPI). *Runs:* **GitHub Action** (Python, scheduled after result days) → JSON, or even in-TS. *Cost:* **$0**. Elo complements DC (fast/robust vs thin data); SPI-style blends offense/defense like DC.
4. **Scheduled re-fit as WC results land.** *Why:* keeps odds live through the tournament without a server. *Effort:* **S** (wire #1 into a cron `on: schedule` Action writing to Storage/repo). *Runs:* **GitHub Action** → Supabase Storage/repo JSON; browser reads. *Cost:* **$0** (Actions free tier). Note V1's verdict: a Cloudflare Worker is only worth it for *kickoff scheduling + Twitch bot*, **not** for this — Actions cron suffices for daily re-fits.
5. **Hierarchical Bayesian (PyMC) version with uncertainty bands.** *Why:* partial pooling is the *correct* fix for thin per-team data and gives honest credible intervals on title odds (not false-precision point estimates). *Effort:* **M–L** (days; sampler tuning, divergence debugging). *Runs:* Python **offline**/Action (**no GPU** — 64 matches, NUTS is fast). *Cost:* **$0**. *Verdict:* do it *after* #1–#4 prove the loop; it's a refinement, not the foundation the other AI implied.
6. **Feed DC λ back into the authoritative sim** so play and result agree (V1's unification goal). *Why:* the watched-live sim and the odds stop contradicting each other. *Effort:* **M**, and it's the **integer-authority landmine** — must port to fixed-point seeded sampling, not float `Math.exp`. Sequence last; it's the point where predictions and the deterministic-sim keystone meet.

**Bottom line:** the other AI's ROI ranking is correct — predictions are the product, need no GPU and no server, and fit static hosting perfectly. Its effort estimates are optimistic by roughly one regularization-plus-validation day each, and it front-loaded PyMC that belongs in generation two. Start with a *shrunk, time-decayed* Dixon-Coles fit and an RPS backtest; that single artifact unlocks the match-card odds, the power ranking, and the Monte-Carlo title race for essentially free.
