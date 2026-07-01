# Retro pixel / 3D player visuals for /subtests — a render-layer verdict

## What the code actually gives the render layer

The sim in `src/lib/subs-draft/match-sim.ts` (673 lines, TDD'd) already does the hard part: every tick it exposes a `Snapshot` (line 26) with `home[]`/`away[]` positions in a clean 0..100 x/0..100 y pitch space, the ball, `poss`, `controlled`, `caption`, `bookings`, `sentOff`, and an event ticker. The `P` interface (line 46) additionally carries `vx, vy` (velocity), `role` (`Cat`), and `rating`. That is the entire contract a render layer needs: **position + velocity + a coarse state**. The current `snapshot()` (line 654) deliberately drops `vx/vy` and per-player state — the first concrete step for ANY visual upgrade is to widen that struct to emit `{x, y, vx, vy, role, id}` per player plus a global `phase` derived from `ballState` ("dribble"/"pass"/"shot"/"attempt"/"loose"). Cheap, additive, and it unblocks sprites, voxels, and procedural limbs identically.

Crucial context the brief flags and the code confirms: **the "pseudo-3D CSS pitch" is not committed** — `grep` for `createMatchSim`/`requestAnimationFrame`/`perspective` finds no consumer. So we are NOT swapping a working CSS-3D scene (V1's "Canvas2D swap is mis-scoped, weeks not days" trap applies to *replacing* an existing 3D scene). We're choosing the render layer for the first time. That materially changes the effort math and, honestly, kills one of the second AI's premises.

## Grading the three routes

### (a) Animated 2D pixel sprites — the correct default

This is how Sensible Soccer, ISS Deluxe, and Kick Off actually did it: billboard pixel characters drawn on a tilted pitch, an 8-direction run cycle plus kick/tackle/celebrate frames, `image-rendering: pixelated`, limbs and hands "for free" as drawn pixels. The second AI's claim that **sprites give the best resemblance-per-effort is correct and well-grounded** for this project, for three concrete reasons:

1. **The math is trivial and integer-safe.** The token you'd render today is already a `<div>` positioned by `x/y`. A sprite is the *same* div with a background-image and a `background-position` offset. Direction picks 1 of 8 from `atan2(vy, vx)` bucketed to 45°; frame index is `floor(distanceTravelled / stride) % nFrames`; state (`kick`/`tackle`) comes from the phase flag. All of this is presentation-only and never touches the authoritative outcome, so V1's **integer-authority + determinism keystone is untouched** — you can drive frame selection from floats because a wrong frame never changes a scoreline.
2. **Perf is a non-issue.** 22 sprites = 22 DOM nodes with `translate3d` + `background-position`, or one `<canvas>` with 22 `drawImage` blits per frame. Either sits at 60fps on a phone. A packed 8-dir × ~10-frame × kick/tackle sheet for two kits is a few hundred KB PNG — negligible on GitHub Pages, and static-export-friendly (drop it in `public/`, no runtime fetch to Supabase).
3. **The art pipeline already exists.** The owner's PixelLab MCP (`create_8_direction_object`, `animate_character`) generates exactly 8-direction walk/run/kick spritesheets. This is the *only* route where the owner's existing tooling maps 1:1 to the deliverable. CC0 packs (Kenney, LPC/Universal-LPC-Spritesheet) are the fallback and are license-clean — which matters given V1's explicit "do not vendor scraped licensed data into a public repo" rule.

The one honest caveat: **8-direction billboards on a perspective-tilted pitch look retro-authentic but slightly flat** (they don't foreshorten). That's a feature here — it's *exactly* the ISS/Sensi aesthetic — but if the owner wants "physical players with hands that reach," a fixed 8-dir sheet can't emote per-limb. That's where procedural animation (below) re-enters.

### (b) True 3D — Three.js/WebGL voxel or low-poly, rigged, + a pixelation/palette post shader

This is the second AI's "actual 3D players with hands" answer, and its effort estimate is **the most optimistic and the biggest trap in the visual set.** Grounded reality for THIS project:

- **Bundle cost is real and permanent.** Three.js is ~150–600KB gz depending on tree-shaking; add glTF loading, an animation mixer, and an `EffectComposer` post chain (render target + pixelation pass + palette-quantize shader) and you are shipping a WebGL app inside a static Next.js `output: export` bundle whose current identity is a lightweight inline-styled dashboard. That's a step-change in page weight and build complexity for a *cosmetic* layer.
- **You must author or source rigged, animated glTF characters** with run/kick/tackle clips — MagicaVoxel voxel models don't come rigged; skinning + retargeting 22 instances (use `InstancedMesh`/`InstancedSkinnedMesh`) is genuinely **weeks (L)**, not days. The pixelation shader itself is a half-day; the rigged content and camera/lighting/occlusion-culling plumbing is the cost.
- **It buys little the sprite route lacks.** The retro pixel *look* is achievable in sprites at 5% of the effort. True 3D only wins if you need real per-limb articulation and a moving camera — and even then, procedural IK limbs on a 2D/Canvas layer (V2 animation study) get you "reaching arms and planting feet" without a 3D engine.

Verdict: **over-scoped for the product ROI.** Park it. Revisit only if the owner's GPU box is producing something that genuinely needs 3D (it isn't — the GPU earns its keep on the *model/RL* path, per V1, not on client render).

### (c) Pure CSS `preserve-3d` voxel divs — one hero only

Building a player out of stacked `transform-style: preserve-3d` voxel divs is charming but each figure is dozens of composited DOM nodes. **22 of them = hundreds of layers the compositor re-transforms every frame** — DOM-thrash, jank on mobile, and painful to animate. The second AI's own framing ("good for ONE hero/celebration figure, not 22") is right. Legitimate use: a single celebration/goal-scorer figure on the results screen, or the draft-complete hero. Not the match view. **S effort, near-zero match-view impact.**

## The sweet spot: pixel skin over procedural motion

The strongest combination — and the one that answers the owner's Rain-World ask *and* the retro ask at once — is to **render pixel-art limb segments on a procedurally-animated (verlet/IK) skeleton** driven by `vx/vy/state`. The sprite route gives the retro skin cheaply; a light IK layer (torso spring node + two IK legs whose feet plant from velocity, two arms that swing/reach) gives the "alive, physical, has hands" quality that fixed 8-dir frames can't. Because the skeleton is ~8 nodes × 22 ≈ 180 points, it's Canvas-cheap, needs no GPU, and stays a pure-TS render layer — no authority change, determinism-safe. Ship fixed sprites first; graduate the ball-carrier and nearby players to IK limbs once the loop proves out.

## Cross-cutting constraints (all routes)

- **Hidden-tab freeze is unsolved and route-independent.** rAF pauses when the tab is hidden (memory: full-window occlusion freezes *everything*, no web fix). This is a sim-loop problem, not a render problem — none of these three routes changes it. Live "watched together" should follow V1: broadcast a seed + events over Supabase Realtime and let each client recompute; the render layer is downstream of that.
- **Bundle on GitHub Pages:** sprites add a static PNG (fine); CSS-voxel adds only CSS; Three.js adds a WebGL runtime (the one route that meaningfully grows the bundle).
- **GPU box:** irrelevant to all three client render routes. It belongs to the prediction/RL factory, not the pitch draw.

## Ranked recommendation

1. **Widen `Snapshot` to emit `vx, vy, role, id` per player + a `phase` flag.** *Why:* unblocks every visual route identically and is the cheapest high-impact first step. *Effort:* **S (hours).** *Runs:* browser (pure TS in `match-sim.ts`). *Cost:* $0. *Note:* keep it additive; existing `match-sim.test.ts` stays green.
2. **Animated 2D pixel sprites via PixelLab 8-dir sheets.** *Why:* best resemblance-per-effort; matches ISS/Sensi target; owner's tooling maps 1:1; perf-trivial with 22 tokens. *Effort:* **M (days)** for the render component + sheet packing; art gen is async PixelLab jobs. *Runs:* browser; art baked into `public/`. *Cost:* $0 (PixelLab subscription already owned). *Libs:* `image-rendering: pixelated`, `background-position` atlas or Canvas `drawImage`; CC0/Kenney/LPC fallback (license-clean). *Tradeoff:* billboards don't foreshorten (that's the retro look).
3. **Procedural IK limbs (pixel-skinned) for the ball-carrier + nearby players.** *Why:* delivers the Rain-World "alive/has hands" quality sprites can't, staying pure-TS/Canvas. *Effort:* **M–L (days→weeks)**; gait/foot-planting is the fiddly Rain-World part. *Runs:* browser. *Cost:* $0. *Libs:* verlet + 2-bone IK (analytic FABRIK). *Tradeoff:* do it *after* sprites prove the loop.
4. **One CSS `preserve-3d` hero figure** for goal/celebration screens. *Why:* charming accent where DOM cost is affordable. *Effort:* **S.** *Runs:* browser. *Cost:* $0. *Tradeoff:* never 22 of them.
5. **True 3D (Three.js voxel + pixelation shader).** *Why:* only if per-limb 3D articulation + moving camera become hard requirements. *Effort:* **L (weeks+)** — rigged glTF content and instancing dominate; the shader is trivial. *Runs:* browser (heavy). *Cost:* $0 hosting but large bundle. *Verdict:* **over-scoped; park it.**

**Cheapest high-impact first step:** #1 (widen the snapshot) then #2 (sprites). **Biggest trap:** the Three.js route (#5) — the second AI's optimistic "days" hides weeks of rigging/instancing for a look sprites already deliver.
