# Verdict updates (2026-07-02) — after xG-unification + the realism arc

xG-unification (the pitch PRODUCES the scoreline; `createMatchSim({scoring})`) changed
the premises several v1/v2/v3 verdicts rested on. Recorded here so no future session
re-litigates a dead rationale.

## Retired / changed

- **Outcome-bias hook (v2 Q5) — RETIRED, obsolete by construction.** It existed to nudge
  play toward an IMPOSED scoreline. There is no imposed scoreline anymore; building it
  now would actively distort the honest xG→result chain. Scripted goal templates
  (`scoreFor`) survive only for the v1 cosmetic route.
- **RL/MARL self-play — STAYS PARKED, but the reason changed.** The old killer argument
  ("a smart agent that loses to the dice looks broken") is dead — intelligence now pays
  into results. The standing reasons are: (1) PERF — 22 policy inferences × 370k steps
  per Copa vs the ~21 ms/match total budget; (2) training wall-clock/failure risk;
  (3) float inference must be deterministic across replays (int8/LUT solvable, but work).
  Benchmark headless inference cost before any training investment.
- **Emergent 2D physics engines (matter.js/rapier) — STAY REJECTED**, but note the old
  "fights the scripted scoreline" leg is dead; the surviving reasons are decisive on
  their own (bespoke z-axis integrator already does the job, WASM floats reintroduce
  cross-client determinism risk, per-step solver cost × 370k, full-rewrite churn).
- **"Cosmetic-only float drift" waiver — INVALIDATED.** The sim is authoritative now, so
  cross-engine float divergence is a RESULTS risk for watch-together across different
  browsers. Cheap containment (not a rewrite): broadcast the host's integer PitchResult
  alongside the seed and have viewers reconcile if their local replay diverges.

## Built since the spikes (this arc — see calibration.test.ts for the gates)

Counters/urgency/keeper-sweep/penalties/goal-moment; committed runs + pass-to-the-run +
one-twos; unit press (hysteresis/cover/trigger); z-gated aerials + duels + knock-downs +
switch of play; team identity (id-hash style packs) + per-player flair; cagey openings,
fatigue fades, sagging lines; compressed flight times + decision cadence (the two
"compression mismatches" instrumentation exposed). Stats gated against real-football
bands over 150 seeded matches.

## Honest residuals (documented in the gates, do not knob-fake)

- Late-goal share ~29-30% vs real ~35%: the gap is substitutions + halftime + stoppage
  time, none of which the fixed-3600-step no-subs sim models.
- Shots ~8.1/team vs real ~12: supply-limited; the road there is deeper build-up
  mechanics (more final-third entries), not appetite knobs.
