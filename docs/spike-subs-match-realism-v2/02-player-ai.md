# Fully AI-controlled players: Utility AI → Behavior Trees/GOAP → MARL self-play

## What "AI-controlled like Rain World" actually means here

Rain World's creatures feel alive because of **procedural physics animation** (the body reacts continuously) layered over **relatively simple decision logic** — not because of neural nets. That separation matters for this assignment: the "brains" tier is orthogonal to the "body" tier. This document is only the brains. And in the actual code, the brains live in one place: `match-sim.ts::decide()` (lines 307–390), the possession-carrier decision. Everything else (`target()`, `steer()`, `separate()`) is off-ball movement and physics that already looks decent. So the whole "make players think" project is really **replacing ~80 lines of `Math.random()`-soaked FSM** with something legible.

Read `decide()` closely and the diagnosis is stark. It is not a state machine — it's a **cascade of independent coin-flips**: shoot at `Math.random() < shootP`, cross at `< 0.45`, dribble-loss at a rating ratio, then a `passProb` gate, then it picks from the top-3 scored mates via `Math.random()`. The *scoring* it already does (line 357–363: `ahead*1.1 + dist(nearest-defender) − dist(carrier)*0.25 + rnd(0,6)`) is **a primitive utility function already**. The second AI's "replace `decide()`'s FSM with utility AI" is therefore not a rewrite — it's finishing a job the code half-started. That's the single most important grounding fact, and it makes the "days, high ROI" claim for Utility AI **correct**, the only estimate the other AI got right.

## Tier 1 — Utility AI (the cheapest high-impact step, and my top pick)

**What.** Every player (not just the carrier) continuously scores candidate actions each decision tick and picks the best. For the carrier: `shoot`, `dribble(dir)`, `pass-to-Xᵢ`, `cross`, `clear`. Off-ball, the same machine scores `press`, `mark(Xᵢ)`, `make-a-run`, `hold-shape`, `drop`, `overlap` — which finally gives `target()` intent instead of the current role-band heuristics.

**Concrete formulas** (all already computable from the tick state — every player carries `x,y,vx,vy,role,rating`):
- **Openness(receiver)** = `dist(receiver, nearestOpp)` normalized. Already computed at line 361.
- **Intercept-risk(pass)** = min over opponents of perpendicular distance to the pass segment, weighted by `(opp.rating/70)` and their closing velocity. This is the piece `decide()` *lacks* — it fires passes blind and only checks interception mid-flight (line 572). Scoring it up front is the biggest realism jump.
- **Progression / xT** = a static 12×8 **Expected-Threat grid** (Karun Singh's xT): `xT(destination) − xT(ball)`. A pass into the box scores high; a square pass scores ~0. This single term makes teams *build toward goal* instead of random-walking. Bake the grid as a `Float32Array` constant (~96 numbers).
- **Shot value** = an xG stand-in: logistic on distance + angle to goal (the code already has `dg`, line 316). Replaces the hand-tuned `shootP`.
- **Pressure(self)** = `dist(carrier, nearestOpp)` (already `pressed`, line 356) — scales down the utility of holding the ball.

**Selection with determinism.** Total utility per action, then **softmax with a temperature** for variety. The trap: softmax needs `Math.exp`, and **V1's keystone finding is that `exp`/`hypot` are not bit-identical across browser JS engines**. For a *cosmetic* sim that's tolerable, but since the roadmap wants "watch together" (V1's near-free Realtime broadcast of a seed), you must **contain drift**: (a) keep the seeded PRNG (replace every `Math.random()` — I count ~40 in these two files — with one `mulberry32`/`xoshiro` stream); (b) do utility math in **scaled integers** (utilities as `int32` in centi-units), and implement softmax as a **integer cumulative-weight table with a rational approximation of exp** (a 256-entry lookup), so selection is a pure integer comparison against the seeded RNG. That is the V1 "integer authority" rule applied to AI. It costs maybe a day extra and is what makes multi-client replay exact.

**Effort: M (3–5 days).** **Where: browser, pure TS**, zero deps, zero cost. **Why it's #1:** it converts the entire visible product from "dots doing Brownian motion" to "a team with a plan," and it does so in the file that already exists, with math the file already half-writes. The other AI is right here.

**One caveat the other AI missed:** utility AI has to stay **cosmetically subordinate to `tournament.ts`**. The authoritative scoreline is Poisson from XI average rating (`simulateMatch`, line 132–137); goals are *scripted* into a corner via `scoreFor()` (line 637). If utility AI makes a team genuinely dominate but the Poisson says they lose, the screen contradicts the scoreboard. So Tier 1 must be **outcome-biased**: feed the pre-decided result in as a soft prior (e.g. nudge the losing team's shot-conversion utility down) — exactly V1's "unify play and result behind one model" conclusion. Skipping this makes better AI look *worse* (visible injustice). This is the subtle trap in "just swap the FSM."

## Tier 2 — Behavior Trees / GOAP for role plans

**What.** Set-pieces and choreographed multi-player plays that utility scoring alone won't reliably produce: **overlapping fullback**, **peel off the last defender for the through-ball**, corner routines (the code already crudely crowds the box, lines 418–421), counter-press triggers. A **behavior tree** per role gates *which* utility set is active (in-possession attacking BT vs. defensive-shape BT); GOAP is overkill and I'd **debunk it for this project** — GOAP's planner earns its keep when action preconditions chain deeply (Killzone-style), and a 90-second cosmetic football loop doesn't have that depth. A BT is the right abstraction; GOAP is over-scoped.

**Effort: L (1–2 weeks) for a good set; S–M for 2–3 marquee plays.** **Where: browser TS.** Libraries: none needed (a BT is ~100 lines), or `behaviortree` (npm) if you want an editor. **Why:** it adds the *recognizable* moments (the overlap, the offside trap) that make viewers say "it's playing football." **Honest ROI verdict: medium and diminishing.** Utility AI already buys 80% of the "alive" feeling; BTs are polish. The other AI's "1–2 weeks" is fair, but I'd **defer most of it** and cherry-pick 2–3 plays as S-effort utility *biases* rather than a full BT layer.

## Tier 3 — MARL / RL self-play

**What.** PettingZoo/Gymnasium multi-agent env + PPO/MAPPO self-play on the GPU box, export a small policy to **ONNX**, run in-browser via **onnxruntime-web** (WASM or WebGPU). This is the "true emergence" path, and **Google Research Football (gfootball)** is the canonical precedent — it exists precisely because football MARL is a *hard research problem*, not a feature.

**Critical grade: the other AI's "weeks+" is optimistically wrong by an order of magnitude, and the payoff is misframed.** Reality:
- **Training** football self-play to non-embarrassing play in gfootball took large compute and careful reward shaping; "weeks" of *wall-clock experimentation* is plausible, but "weeks of work" implies it's likely to succeed, which it isn't for a solo hobby project. It "looks weird before brilliant" — and often never reaches brilliant.
- **Inference cost is real:** 22 agents × ~30 fps = 660 forward passes/sec. onnxruntime-web WASM does small MLPs fine, but you'd **batch all 22 into one tensor per frame** and keep the net tiny (2 hidden layers). WebGPU backend helps but is still maturing. Model size is a non-issue (tens of KB); **latency and jank are**.
- **The determinism trap is fatal here.** A learned continuous policy runs float matmuls whose last-bit results differ across WASM/WebGPU/engines — so **RL breaks V1's "watch together = replay a seed" architecture** unless you quantize to int8 *and* pin the backend. That's a serious constraint the other AI never surfaced.
- **Payoff for a cosmetic sim: poor.** The scoreline is *already decided* by `tournament.ts`. RL agents optimizing "score goals" will fight the scripted outcome. You'd get emergent motion you then have to *override*. The effort/immersion ratio is the worst on the board.

**Effort: L+ (weeks–months, high failure risk).** **Where: GPU-offline train → ONNX baked into static bundle → browser infer.** **Cost: $0 marginal (owner's RTX 3060 — pick the 3060 over the 5060: 12 GB and mature CUDA beat Blackwell's 8 GB + bleeding-edge toolchain for training).** **Verdict: a research spike, not a roadmap item.** If pursued, scope it to *off-ball movement only* (leave scripted goals alone) so it can't contradict the scoreboard.

## Ranked recommendations

1. **Seed the RNG (mulberry32, one stream) across `match-sim.ts` + `tournament.ts`.** *Why:* V1's keystone; prerequisite for everything, including "watch together." **S (hours). Browser TS. $0.** Do this *first*, even before AI — it's the enabling move.
2. **Utility AI for the carrier + off-ball, integer-softmax selection, xT grid + intercept-risk + xG shot term.** *Why:* the single biggest realism jump; finishes what `decide()` started; keeps determinism. **M (3–5 days). Browser TS, no deps. $0.** ← **cheapest high-impact step.**
3. **Outcome-bias hook** so utility play never contradicts `tournament.ts`'s Poisson result. *Why:* prevents "better AI looks unjust." **S (hours). Browser TS. $0.**
4. **2–3 marquee behavior-tree plays** (overlap, offside trap, counter-press) as utility biases, not a full GOAP layer. *Why:* recognizable football moments; diminishing returns beyond this. **M (days). Browser TS. $0.**
5. **Full BT role library.** *Why:* polish. **L (1–2 wks). Browser TS. $0.** Defer.
6. **MARL self-play → ONNX.** *Why:* true emergence, but fights the scripted scoreline and breaks cross-client determinism. **L+ (weeks–months, high risk). GPU-offline + onnxruntime-web. $0 marginal.** Research spike only; scope to off-ball motion.

**Biggest trap:** believing better AI is free. The learned/softmax float path silently breaks V1's integer-determinism keystone and the near-free "watch-together" replay model — and *any* smart AI that contradicts the already-decided `tournament.ts` scoreline makes the product look *broken*, not better. Contain both by keeping outcome authority in `tournament.ts`, running selection on seeded integers, and treating RL as a spike, not a feature.
