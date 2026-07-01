## Prioritized roadmap — fastest-improvement-first

Ordered by realism/immersion per unit effort. Effort: S = hours–1 day, M = days–1wk, L = weeks. "Where" = client (free, GitHub Pages) / Supabase (free tier) / server (cheap paid).

### Quick wins — hours to days, client-only, zero new hosting

| # | What | Impact | Effort | Where | Techniques / libs |
|---|------|--------|--------|-------|-------------------|
| Q1 | **Ball height axis (z, vz, gravity)** — crosses/corners/goal-kicks loft, headers only connect in a head-zone, keeper claims high balls; render as token-lift + growing ground shadow (shadows already drawn) | High | M | client | projectile+bounce (restitution ~0.6), no lib — biggest single *play* jump |
| Q2 | **Seeded PRNG + fixed-timestep accumulator** — replace all ~20 `Math.random()` in `match-sim.ts`; step in fixed 1/30s | High | M | client | `mulberry32`; TDD: two sims from same seed → byte-identical snapshots. *Keystone for the whole live layer* |
| Q3 | **Magnus curve on struck balls** — free-kicks/corners/finesse shots bend | High | S | client | `a_perp = k·spin·speed` rotating (vx,vy); tune by eye |
| Q4 | **Move rAF render off React state → Canvas2D** — kill the 24 setState/frame (verified in `pitch-view.tsx`); one `draw(snapshot)` call | High | M | client | raw `CanvasRenderingContext2D`; frees frame budget for everything below |
| Q5 | **Dixon-Coles + exp-link λ scoreline model** — replace `0.35+2.4·(s/total)` Poisson in `tournament.ts` | High | S | client | DC τ low-score correction (~30 lines), γ≈0 at neutral WC venues; shared `xg.ts` |
| Q6 | **Turning radius + reaction lag** — clamp angular velocity change/step, per-player 80–250ms retarget delay | High | S | client | Reynolds "turn-rate clamp"; ends the "hockey air-bot" feel |
| Q7 | **Motion polish: body-facing ellipse, easing, velocity-scaled trail** — rotate token to `atan2(vy,vx)`, lean/overshoot | High | S | client | Disney-12-principles caricature; near-free on Canvas2D |
| Q8 | **Web Audio SFX layer** — whistle, kick, net-ripple, post, crowd "ooh", goal roar (~10 one-shots, ~300KB) | High | S | client+Storage | one `AudioContext` + buffer pool; gate behind play button; master-mute for streamers |
| Q9 | **Templated pt-BR phrase-bank commentary** — 6–12 variants × event.kind × danger bucket, dedupe recent | High | S–M | client | FM-style slot-fill; split play-by-play vs colour filler |
| Q10 | **Richer event vocabulary from the sim** — emit `{kind,side,playerId,x,y,danger,xg?}` | High | S | client | multiplier for Q8/Q9/crowd; `danger` from dist-to-goal already computed |
| Q11 | **Tiered palpites scoring for subs matches** — exact=5, GD=3, outcome=1, pen=+0.5; rank by avg/match | High | S | client+Supabase | reuse existing `classifyPrediction`; RPS later for serious board |
| Q12 | **Attribute-driven kinematics** — split `pace` into topSpeed/accel/agility so draft ratings show on the pitch | Med | S | client | rides Q6 machinery; makes drafting *matter* |
| Q13 | **Wall-clock match minute (solo freeze fix)** — derive render minute from `Date.now()`, not rAF accumulation | High | S | client | interim of Q2/live layer; kills freeze for solo viewer immediately |
| Q14 | **Formation block + line-of-engagement** — team scalars (line-height/compactness/width), press only past a y-trigger | High | S | client | reshape `target()`; holding block that springs = "real defending" |

### Medium bets — days to weeks

| # | What | Impact | Effort | Where | Techniques / libs |
|---|------|--------|--------|-------|-------------------|
| M1 | **Web Worker sim + Page Visibility** — port pure sim into a Worker on `setInterval(1000/30)`; main thread renders only when visible | High | M | client | fixes common background-tab freeze (NOT full OBS occlusion — be honest) |
| M2 | **Shared clock + broadcast `{seed,startEpochMs,goalScript}`** — clients fast-forward local sim to `targetTick` | High | S | Supabase | Realtime broadcast (not positions); Cristian's-algo clock sync; *the "watched together" hinge* |
| M3 | **Utility-scored decisions** — replace RNG FSM branches with softmax over shoot/pass/dribble/cross scores | High | S–M | client | xT/possession-value scoring; makes play *legible* |
| M4 | **Camera work: pan/zoom-to-ball + goal replay** — dead-zone easing cam; 3–4s snapshot ring-buffer replayed at 0.35× | High | M | client | `ctx.setTransform`; biggest "we're watching a broadcast" gain |
| M5 | **Adaptive crowd bed** — loop whose gain/low-pass tracks smoothed `danger`, roars on goal | High | S–M | client+Storage | one-pole LP on danger; reactive crowd = communal feel |
| M6 | **Persist draft/tournament to Supabase** — `subs_teams/bracket/status` JSONB blobs, RLS-gated, writes via Edge Function | High | M | Supabase | serialize the pure `DraftState`; unlocks identity/persistence |
| M7 | **Presence spectator count + synchronized kickoff lobby** — "142 subs watching", countdown to `kickoff_at` | High | S | Supabase | Realtime Presence (free); 80% of "watched together" for hours of work |
| M8 | **Goal "moments"** — slow-mo replay + lower-third + roar sting + duck crowd + 2s stat pop | High | M | client | compounds Q1/Q4/Q8; the clip-able payload |
| M9 | **StatsBomb event-stream replay adapter** — drive pitch from a real WC-2022 match's ~3,400 x,y events; same `MatchSim` interface | High | M | client | vendor JSON in `public/`; Catmull-Rom interp + 360 freeze-frames; documentary-grade, needs attribution |
| M10 | **Seed player attributes from real ratings** — Sofifa/EA-FC CSV → `public/data/ratings.json` | High | S | client | replace scalar `rating` with pace/pass/shoot/def vectors |
| M11 | **Elo/Glicko updates across the tournament** — teams earn strength; upsets get *earned* | Med | M | client | World-Football-Elo (K≈40–60, GD multiplier) → λ ratio |
| M12 | **Emote storm + live MVP tally over Realtime** — auto 🎉 burst on goal; ephemeral broadcast only | High | S | Supabase | broadcast-only (never persist emotes — budget) |
| M13 | **Monte-Carlo win-prob + live in-match win-prob curve** — P(champion), curve updates on goal/red | Med | M | client | 10k sims; drive clock off Date.now()/Worker |
| M14 | **RPS scoring + calibration harness** — proper score for serious leaderboard; reliability curve backtest in `experiments/` | Med | M | client | Constantinou-Fenton RPS; tune ρ/K/γ to minimise RPS |
| M15 | **Build-time cloud TTS commentary** — pre-gen finite phrase-bank fragments (ElevenLabs/Azure pt-BR) → Storage, stitch at runtime | Med | M | build+Storage | finite templates = one-time cost, zero runtime latency |
| M16 | **Scripted goal variety + goal-template library** — header/cutback/screamer/penalty by build-up; match scorer role | High | S–M | client | repetition is the immersion-killer once subs watch several |

### Big bets — weeks+, may need a cheap server

| # | What | Impact | Effort | Where | Techniques / libs |
|---|------|--------|--------|-------|-------------------|
| B1 | **Scheduled kickoff via pg_cron + Edge Function** — matches start on a schedule even if no client is open; advance bracket authoritatively | High | S–M | Supabase | `pg_cron` flips status + stamps seed/startedAt; makes it a *real event* |
| B2 | **Twitch OAuth + sub-gating** — token exchange in Deno Edge Function; gate *owning a team*, not spectating | High | M | server/Edge | needs broadcaster token cached hourly; Kick best-effort |
| B3 | **Channel-points / Predictions bot** — Twitch Predictions API opened at kickoff, resolved from authoritative scoreline | Med | M | server ($5/mo worker) | needs persistent EventSub websocket; proven Twitch hook |
| B4 | **Season persistence / dynasties** — player growth, re-draft window, repeat-champion badges | Med | M–L | Supabase | extend existing `StatusMap`; do AFTER >1 tournament watched |
| B5 | **PixelLab sprite players** — one recolorable 8-dir sheet + keeper, hue-shift per kit | Med | M | client | existing PixelLab pipeline; NEVER per-team art (bundle trap) |
| B6 | **Cloudflare Durable Object authoritative room** — only if >200 concurrent Realtime conns or live inputs | Med | L | server | WebSocket Hibernation (bills nothing idle); the *correct* paid escalation |

### Do this next — TOP 5

1. **Q2 — Seeded PRNG + fixed timestep** (`match-sim.ts`). The keystone: unlocks shared viewing (M2), self-healing freeze, replays. Do it TDD-first.
2. **Q5 — Dixon-Coles scoreline model** (`tournament.ts`, new `xg.ts`). One afternoon; makes *outcomes* look like real football. Pair with **Q11** (tiered palpites points) to fuse the two games' economy immediately.
3. **Q4 — Canvas2D render off React state** (`pitch-view.tsx`). Kills the 24 setState/frame hotspot and frees the frame budget every visual upgrade needs.
4. **Q1 + Q3 — Ball height + Magnus curve.** The two biggest *play*-believability jumps: aerial play, headers, curling shots. Shadows are already half-built.
5. **M2 + M7 — Broadcast `{seed,startEpochMs,goalScript}` + Presence spectator count / synchronized kickoff.** Once Q2 lands, this is small and additive on free-tier Supabase, and it's what converts 40 solo screensavers into one watched-together event.

**Explicit traps to avoid:** streaming per-frame positions over Realtime (defeats determinism, blows message budget); adding Gaussian noise to the deterministic predictor instead of the real joint PMF; confidence-as-multiplier scoring (not proper, invites spam); any LLM/TTS on the *live per-event* path (latency, cost, needs a key a static bundle can't hold — keep generation at build time); client-side matter.js or any 2D solver expecting football physics for free (none model height, all fight your scripted scoreline); per-national-team art (bundle bloat); Three.js/skeletal (2.5D fakery wins on this budget); Render's free spin-down (~60s cold start disqualifies the live-kickoff path); in-browser ML movement policies (5% of the payoff of utility-AI for the effort).

---

# Reality-check — adversarial feasibility critique

I read the actual spike (`match-sim.ts` 673 lines, `tournament.ts`, `pitch-view.tsx`, `tournament-view.tsx`, `page.tsx`, `match-sim.test.ts`). The plan is directionally sound and the determinism insight is real. But several load-bearing premises are wrong or under-scoped against the code as it actually stands. Blunt corrections below.

---

## A. Wrong / misleading claims about the current code

**A1 — "Move rAF render off React state → Canvas2D … kill the 24 setState/frame (verified in pitch-view.tsx)" (Q4). The "24 setState/frame" figure is fabricated.** The actual loop (`pitch-view.tsx` lines 92-124) fires **at most 8** setState calls/frame, and 4 of them are already guarded (`setStats`, `setBookings`, `setSentOff`, `setCaption` only fire on change). The genuinely per-frame ones are `setHomePos`/`setAwayPos`/`setBall`/`setBallTrail` — 4. So the hotspot is 4, not 24, and React batches them into one render. Not nothing, but not the crisis described.

**A1b — Bigger problem the plan misses entirely: the players are DOM divs with CSS 3D transforms, not a flat layer you can swap for Canvas2D.** Each token (`PlayerToken`, `BallToken`, `TrailDot`) is an absolutely-positioned `<div>` living inside a `rotateX(56deg) perspective(760)` 3D scene, counter-rotated per token, depth-scaled, with ground shadows. Canvas2D has **no 3D transform / perspective / z-buffer** — to move rendering to Canvas2D you must **hand-write the perspective projection, per-token back-to-front painter's-algorithm sorting, and the billboard counter-rotation yourself.** That's not "one `draw(snapshot)` call" — it's re-deriving the entire pseudo-3D pipeline that CSS currently gives for free. Q4 is mis-scoped as M; realistically **L**, and it's a genuine visual-regression risk. WebGL/three.js would actually be the more honest port target for this scene, which the plan explicitly (and correctly) rejects on budget — but that rejection also undercuts the Canvas2D premise.

**A2 — The determinism refactor (Q2) targets the WRONG file for outcomes.** The plan says "replace all ~20 `Math.random()` in `match-sim.ts`." Actual count in the subs-draft dir is **33**, and a large, decisive share lives in **`tournament.ts`**, not `match-sim.ts`: `poisson()`, the goal-minute generator `min()`, `pickWeighted` scorer/card selection, `shootout()`, `injuryLength()`, and `shuffle()` (the bracket seeding itself). **The authoritative scoreline, scorers, minutes, cards, and the entire bracket draw are all `Math.random()` in `tournament.ts`.** If you seed only `match-sim.ts`, every viewer still sees a *different scoreline, different scorers at different minutes, and a different bracket* — the cosmetic dots would be synced while the actual match diverges. **Determinism must cover `tournament.ts` first (or equally), and the shared broadcast payload is not `{seed, startEpochMs, goalScript}` — it's `{bracketSeed}` plus per-match seeds, because the bracket draw is itself random.** This is the single most important correction: the roadmap's keystone is pointed at the smaller half of the RNG.

**A3 — "the sim just makes the play look believable" understates the coupling, but the architecture also makes determinism EASIER than the plan implies.** The whole tournament is precomputed the instant a round starts (`playRound` → `simulateMatch` for all 16 matches at once, `tournament-view.tsx` line 128), and the clock is a pure *reveal* mechanism (`clock` drives which events have "crossed"). That means outcome-sync doesn't even need a live clock broadcast for the numbers — broadcast the seeds once, every client recomputes the identical precomputed bracket, and the clock is just `Date.now()`-derived. Good news the plan doesn't cash in: **you already have wall-clock-able reveal; the freeze fix (Q13) is nearly free here** because `clock` is set from a `setInterval`, and event reveal is idempotent on `clock`. But note the corollary trap ⬇.

---

## B. Gotchas the plan will hit

**B1 — `setInterval` in a background tab is throttled to ≥1 Hz (and heavily on mobile), and rAF is fully paused — but your MEMORY already documents the harder truth: full window OCCLUSION freezes everything (timers, workers, WSS, audio) and there is NO web fix.** The plan admits OBS occlusion for pixels but still claims "the audio layer keeps the match alive for listeners" and "Web Audio is NOT rAF-throttled, so the soundtrack survives a hidden tab." Per your own `background-tab-throttling.md` memory ("timers/worker/WSS/video/audio ALL froze in OBS"), **that audio claim is false under the exact occlusion case that matters for a streamer.** Web Audio survives *backgrounding* (tab hidden but window visible) — it does NOT survive occlusion. Don't sell the crowd-bed as an occlusion mitigation; it isn't one. This directly contradicts M5/M8's "reactive crowd survives" framing.

**B2 — Determinism across clients is NOT free just because "it's all one JS engine."** The plan says float drift is dodged because there's no cross-language boundary. True for cross-*language*, but you still have: (a) `Math.hypot`/`Math.exp`/trig are **not** IEEE-754 bit-identical across browser engines (V8 vs JavaScriptCore vs Gecko differ in the last ULP of transcendentals) — the sim calls `Math.hypot` and `Math.exp` every frame; over 5400 fixed steps those diverge. (b) The current step is **frame-rate-dependent via `dt`** (`step(dt, progress)`, `dt = Math.min(0.05, …)`), so two clients at 60 vs 120 vs 144 Hz integrate *different* trajectories even with the same seed. Q2's "fixed 1/30s timestep" fixes (b) but you must **also decouple the render framerate from the sim tick** (accumulator pattern) AND accept that the *cosmetic* dots may micro-diverge across engines — fine for cosmetics, fatal if you ever try to derive anything authoritative from dot positions. Keep authority in `tournament.ts` integers (goals/minutes), never in float positions. The plan half-says this; make it a hard rule.

**B3 — Supabase Realtime free-tier limits are looser AND tighter than stated.** Plan says "200 concurrent Realtime connections, 2M messages/mo." Current Supabase free tier is **200 concurrent Realtime clients and 2M messages/month** — roughly right — but **Presence and broadcast both count against the message quota**, and Presence is chatty (every join/leave/heartbeat is messages). "142 subs watching" via Presence (M7) with churn during a stream can burn the 2M/mo faster than a napkin says. Also the free project **pauses after 7 days of inactivity** — for an "appointment event" product that's a live footgun (plan notes this only in the escalation table, not as a launch risk). Mitigation: a keep-alive ping or accept Pro ($25) sooner than the plan implies.

**B4 — `pg_cron` + Edge Function scheduled kickoff (B1) has a cold-start + auth wrinkle the plan waves past.** Supabase Edge Functions cold-start is ~real (hundreds of ms to low seconds after idle), and `pg_cron` calling an Edge Function needs `pg_net` + a stored service key / `vault` secret. That's fine, but it's **not "S–M"** once you add the auth plumbing, the idempotency (cron can double-fire), and testing a scheduled path you can't easily run locally. Call it M. Also: your SECURITY.md invariants mean the new `matches`/`subs_*` tables need **explicit grants to both service_role and anon** (your CLAUDE.md "Grants gotcha" — new tables get ZERO grants because "auto-expose" is OFF). Every new table in M6/B1 must ship grants + RLS + the `scripts/db/` assertions, or CI's `database` job fails. The plan's Supabase items don't budget for this recurring tax.

**B5 — Dixon-Coles (Q5) is labeled S and "one afternoon." The math is small; the CALIBRATION is not.** Dropping DC's τ low-score correction in is ~30 lines, yes. But the current model is `poisson(0.35 + 2.4·(s/total))` where `s` = avg XI rating (66-93) — feeding rating-ratios into a λ that's supposed to be goals-per-team requires **refitting the ρ correlation and the attack/defense scale to your rating distribution**, or you get nonsense (e.g. DC τ only corrects 0-0/1-0/0-1/1-1 cells; if your λs are miscalibrated the correction is cosmetic). Without real match data to fit against, you're eyeballing — which is fine, but it's a *tuning loop*, not an afternoon. The honest version of Q5 is "S to wire, M to make the score distribution actually look like football." Pair it with the M14 calibration harness or you won't know if it worked.

**B6 — Ball height / z-axis (Q1) is more invasive than "M."** The ball is a 2D `{x,y,vx,vy}` threaded through ~15 call sites (passes, shots, crosses, corners, goal kicks, keeper claims, `checkOut`, `integrateBall`, dribble-lead). Adding `z,vz,gravity` means every one of those decides whether it's a ground or aerial ball, headers gate on a head-zone height window, `checkOut` must ignore z, keeper claims need a reach-height, and the **render** must map z → token-lift + shadow-grow inside the existing CSS-3D scene (the shadow is drawn but static). This is the single biggest *play* win, agreed — but it's a solid **M leaning L** and it will churn the sim tests (they assert on 2D trajectories). Worth it; just don't schedule it as a quick win.

---

## C. Things that won't work / are the wrong tool

**C1 — "The final scoreline is authoritative and the sim just places scripted goals" is already the design — but broadcasting `{seed, startEpochMs, goalScript}` conflicts with the precompute model.** There is no `goalScript` to broadcast at kickoff *if you also want determinism from a seed*, because the goals ARE derived from the seed via `tournament.ts`. Pick one: (a) seed-only (clients recompute the whole result — canonical, tiny payload, requires seeding `tournament.ts`), or (b) result-blob broadcast (send the computed `MatchResult[]` — larger, no need to seed the outcome RNG, but then determinism of `tournament.ts` is irrelevant and Q2 shrinks to cosmetic-only). The plan mixes both and lists them as complementary. They're **alternatives.** Recommend (a) but be clear it's an either/or.

**C2 — Twitch OAuth sub-gating "gate owning a team, not spectating" (B2) needs a persistent secret store and a token-refresh loop that a static GitHub Pages bundle cannot hold.** Correct that it goes in a Deno Edge Function — but the plan lists B2 as "M / server-Edge" without noting you need the broadcaster token cached & refreshed (hourly), which means either `pg_cron` refresh or the Cloudflare Worker. It's the first thing that genuinely breaks the "$0" story. Fine, just don't let it hide inside a medium bet — it's the paid-tier trigger.

**C3 — StatsBomb replay adapter (M9) — ToS/licensing.** StatsBomb Open Data is free **for non-commercial use with attribution**; a subs game tied to a streamer's channel (channel points, sub-gating) is plausibly commercial. This is a licensing landmine the plan flags only as "needs attribution." Verify the license against your use before shipping real-match event data. Same caution for Sofifa/EA-FC ratings scraping (M10/B5-adjacent): EA's data is not licensed for redistribution; a `ratings.json` in a public repo is a redistribution. **Do not vendor scraped FIFA ratings into a public GitHub repo.** Use your own mock ratings (already in `data.ts`) or a genuinely open dataset.

**C4 — "Adaptive crowd bed / audio survives hidden tab" — see B1. It does not survive occlusion.** Cut the claim.

---

## D. Corrected priority order

The plan's Top 5 is close but has the keystone aimed at the wrong file and schedules two L-tasks as quick wins. Fixed order:

1. **Q2 CORRECTED — Seed `tournament.ts` FIRST (bracket + outcomes), then `match-sim.ts`.** TDD: same seed → identical bracket, identical `MatchResult[]`, then identical snapshots after N ticks. This is the real keystone. Do the outcome half before the cosmetic half — the outcome is what "everyone sees the same match" actually means. (Effort: M, was mislabeled by targeting only the sim.)

2. **Q13 + Q2's fixed timestep — wall-clock reveal + accumulator.** Nearly free given the precompute+`clock` model already in `tournament-view.tsx`. Kills the solo-viewer freeze immediately, decouples sim tick from render Hz (B2 fix). Do this WITH Q2, not after.

3. **Q5 + Q11 — Dixon-Coles (scoped honestly as "wire in an afternoon, tune over days") + tiered palpites scoring.** Outcome realism is the cheapest believability-per-hour win and needs no new infra. Add the M14 calibration check early so you can tell if the distribution improved.

4. **M2 + M7 — broadcast seeds + Presence count / synchronized kickoff.** Only after #1, and remember the payload is seeds (per C1 option a), Presence burns message quota (B3), and new tables need grants+RLS+db-assertions (B4). This is what turns solo screensavers into a watched event — highest immersion payoff once determinism lands.

5. **Q1 — Ball height/z-axis (rescheduled from quick-win to first medium bet).** Biggest single *play*-believability jump, but it's M-leaning-L and churns the sim tests. Do it deliberately, not as a Friday afternoon.

**Demoted out of Top 5:** Q4 (Canvas2D) — it's an L-effort re-implementation of the CSS-3D pipeline with real visual-regression risk and only a 4-setState/frame payoff; do it *only* if profiling on a real device shows the DOM path janks, and consider WebGL if you go there at all. Q3 (Magnus curve) stays a genuine cheap S but is cosmetic polish, not top-5.

**Additional traps to add to the plan's list:** don't vendor scraped FIFA/StatsBomb data into the public repo (C3); don't sell audio as an occlusion mitigation (B1/C4); don't treat `{seed}` and `{goalScript}` broadcasts as complementary — pick seed-only (C1); every new Supabase table must ship grants+RLS+`scripts/db/` assertions or CI red (B4); don't assume `Math.hypot`/`Math.exp` are bit-identical across browsers — keep authority in integers, never float positions (B2).
