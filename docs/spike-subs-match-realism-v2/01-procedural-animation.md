# Rain-World-style procedural / IK player animation for baltfut

## The one fact that reframes the whole assignment

The other AI keeps calling this a "render-layer swap driven by pos/velocity/state — not a rewrite." That framing is *directionally* correct and I agree with it, but it hides where the real work is. The sim (`src/lib/subs-draft/match-sim.ts`, 673 lines) already gives you everything a procedural skeleton needs: every tick each player has `x, y, vx, vy, tx, ty, role, rt` (lines 46–57), and `separate()` (lines 472–492) already resolves body overlap. So a body layer genuinely *is* additive to the sim. The trap is the **render substrate**, not the physics. Today each token is a React `useState`-driven `<div>` inside a `perspective:760 / rotateX(56deg) / preserve-3d` scene (`pitch-view.tsx` lines 167–180, 246–258), counter-rotated with `rotateX(-56deg)` so billboards stand up. That architecture cannot host 22 articulated limb-skeletons — you'd be reconciling ~180 DOM nodes through React state every frame. **The moment you add limbs you must move to Canvas2D/WebGL**, and V1 already flagged "Canvas render swap is mis-scoped because the pitch is a CSS-3D scene (weeks, not days)." That caveat applies here in full and the other AI under-weights it.

## What Rain World actually does (and what transfers)

Rain World's creatures are chains of masses connected by distance/spring constraints (Verlet-style relaxation), with limbs solved by simple reach-and-plant IK, plus "cosmetic" sprite meshes stretched over the physics points. Crucially, the *physics is the animation* — there are no keyframes. Two techniques transfer cleanly to a top-down footballer:

1. **Verlet spring bones** for the torso/hips: 2–3 point-masses with distance constraints give you the lean, bob and whip that reads as "alive." This is cheap and deterministic-friendly.
2. **Foot-planting IK gait** — the genuinely hard part, and the other AI hand-waves it. The real algorithm (the standard "procedural foot IK" from the GDC talks and countless Unity implementations) is: each foot has a *planted* world position and a *stepping* state. You compute a desired foot position ahead of the hip along the velocity vector (`stride = k·speed`); when the planted foot drifts beyond a threshold from that desired spot, you trigger a step — lerp the foot along an arc (raised via a sine `y-lift`) to the new target over ~0.12–0.2s, then re-plant. Alternate left/right by phase. **Gait emerges from speed**: at `JOG=12` you get slow long-dwell steps, at `SPRINT=20` (constants at lines 62–63) the stride and cadence scale up, and the walk→run→sprint transition is free because it's all derived from `|v|`. The 2-bone leg (hip→knee→foot) is solved with **analytic 2-bone IK** (law of cosines — exact, cheap, no iteration), which is strictly better here than FABRIK or CCD. Reserve FABRIK/CCD for the arms only if you want 3+ segment reach on tackles/throws; for 2-segment limbs, closed-form trig wins on both speed and determinism.

Lean/anticipation: bank the torso from **acceleration**, not velocity — you already have last-frame velocity, so `accel = (v - vPrev)/dt`, and tilt the torso spring root opposite to `accel` (a sprinter leans into acceleration, brakes lean back). This one line is 60% of the "it feels physical" payoff.

## The determinism landmine (V1's keystone, non-negotiable)

V1's keystone is a **deterministic seeded sim with integer authority** because `Math.hypot/exp` are not bit-identical across engines, and "watched together" broadcasts only a seed. A Verlet/IK body layer uses `Math.sin`, `sqrt`, float lerps every frame — it is *inherently* non-reproducible across browsers. **This is fine, and it's the whole reason the body layer is safe: it must stay 100% cosmetic and read-only.** It consumes the authoritative integer positions and decorates them; it must never feed a value back into `match-sim.ts` or influence `tournament.ts` (where the real scoreline, scorers, cards, and bracket draw live as `Math.random()`). Two clients watching the same seed will have *identically-positioned tokens* but slightly different toe placement — nobody can tell, and it never desyncs the match. So the rule is simple: **the skeleton is a pure function of the current cosmetic snapshot; keep it out of the authority path.** The other AI never states this constraint; it's the single most important guardrail.

## Grading the other AI's effort claims

"Charming first version (torso + swinging IK legs/arms reacting to velocity) a few days; convincing version days–weeks" — **partly right, partly optimistic.**

- **Right:** the physics math is trivial (~8 nodes × 22 ≈ 180 points is nothing; a Canvas can push this at 60fps easily; GPU is "overkill," correct). Utility of the sim data being pre-computed is real.
- **Optimistic / omitted:** (a) It never budgets the **render migration off CSS-3D + React-state**, which V1 says is the weeks-scale item. A "few days" assumes a canvas already exists; it doesn't. (b) **Foot-locking is the fiddly part they admit took Rain World long, then still estimate in days** — realistic tuning of stride length, step-trigger threshold, foot-lift arc, and cadence so it doesn't ice-skate or moon-walk is easily a week of iteration alone. (c) Ragdoll-on-fouls needs a state transition from IK-driven to free Verlet and back (the sim has `foul()` at line 249 you can hook), another few days to not look janky. (d) rAF **freezes in a hidden/occluded tab** (V1, MEMORY's background-throttling note) — no body layer changes that; don't sell "always alive."

Honest total for a *convincing* version: **3–5 weeks**, not "days." A *charming* version: **~1 week**, but only after the canvas exists.

## Rendering the limbs — pick the substrate deliberately

- **Canvas2D lines/capsules (recommended):** draw the tilted pitch, then each skeleton as stroked segments + filled torso, with a per-player `scale` from depth (you already compute `depthScale` at line 244). One canvas, one rAF, manual painter's-order by `y`. Retro pixel look via `imageRendering:pixelated` on an upscaled low-res backing store. This is the sweet spot: cheap, deterministic-free, ships static.
- **Pixel-art skinned segments:** draw PixelLab-generated limb sprites *along* the Verlet bones (physics motion + pixel skin) — the exact Rain-World "cosmetic mesh over physics" trick, and it dovetails with the owner's existing PixelLab pipeline (MEMORY: craque-art). Higher art cost, best payoff.
- **WebGL/Three.js:** unnecessary for 180 points; only worth it if you later go true-3D rigged (a *different*, larger project — out of scope for "Rain World style," which is explicitly 2D soft-body).

## Ranked concrete steps

1. **Torso lean + squash/bob from velocity & acceleration, still on the existing token `<div>`s** — *S (hours). Browser. $0.* No canvas needed: tilt/scale each existing billboard by `accel` and add a run-cycle bob from `|v|`. Instantly reads "alive," zero architecture risk. **This is the cheapest high-impact first step — do it before anything else.**
2. **Stand up a Canvas2D pitch layer that mirrors the current snapshot** (dots only, no limbs yet) — *M (days). Browser. $0.* De-risks the substrate migration V1 warned about; keep the CSS-3D version until parity. This is the real gate; everything below depends on it.
3. **2-bone analytic IK legs with foot-planting gait** — *L (weeks). Browser. $0.* The centerpiece. Law-of-cosines legs, stride ∝ speed, step-trigger threshold, sine foot-lift. Budget a full week just tuning so it doesn't ice-skate.
4. **Verlet spring torso + swinging IK arms (balance swing, reach-on-tackle, throw-in windup)** — *M–L (days→weeks). Browser. $0.* Hook arm reach to the sim's `giveBallTo`/tackle path (line 595) and throw-in (line 176).
5. **Ragdoll on fouls/collisions** — *M (days). Browser. $0.* On `foul()` (line 249) switch the fouled skeleton to free Verlet for ~0.8s, then blend back.
6. **Pixel-art skinned limb segments via PixelLab** — *M–L. Art gen offline (PixelLab), render in browser. ~$ (PixelLab credits only).* Optional visual tier atop steps 3–4; reuses the existing pipeline.
7. **Multi-attribute ratings feeding animation** (pace→cadence, stamina→late-match slump) — *S–M. Browser.* The sim already has `pace` and a `stam` fatigue term (lines 80, 452); wiring these to gait cadence is nearly free and ties into V2's separate "players" workstream.

## Bottom line

Cheapest high-impact first step: **#1 — velocity/acceleration lean+bob on the existing tokens, hours of work, no canvas.** Biggest trap: **treating the limb layer as a drop-in while ignoring that CSS-3D + per-frame React state cannot host 22 skeletons — the mandatory Canvas2D migration is the weeks-scale cost V1 already called out, and the body physics must stay strictly cosmetic and out of the deterministic authority path.** GPU earns nothing here (180 points); keep the RTX box for the RL/ML workstreams. Everything stays free, static, and Supabase-only.
