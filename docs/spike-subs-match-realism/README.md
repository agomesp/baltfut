# Spike — making the /subtests subs match feel like a real, watched-live match

> Research spike (2026-06-30). **Docs only — no code was changed.** Everything here is a proposal / study; prioritize from [ROADMAP.md](ROADMAP.md).

## Executive summary — making the /subtests subs match feel real & watched-live

**The opportunity.** The `/subtests` spike already has a genuinely good bespoke engine: a 673-line rule-based 2D sim (possession FSM, pressing, set-pieces, cards→send-offs) and a tournament model that carries suspensions/injuries across rounds. What it lacks is not *simulation* — it's **believability of outcomes**, **believability of the moment**, and any notion of **watching together**. Every one of the 9 deep-dives converges on the same conclusion: almost all the realism wins are pure client-side TS (free on GitHub Pages), and the one hard prerequisite that unlocks the "watched-live" layer is cheap and additive on the existing Supabase free tier.

**The single most important insight (cross-cutting, appears in 6 of 9 dives): make the sim deterministic from a seed, and drive its clock off a shared server timestamp — not `requestAnimationFrame`.** Today the sim calls `Math.random()` at ~20 sites (verified in `match-sim.ts`) and accumulates time via rAF, which means (a) every viewer sees a *different* match, and (b) the view freezes when the tab is backgrounded. Replacing `Math.random()` with a seeded PRNG (`mulberry32`, ~10 lines) plus a fixed-timestep accumulator turns the entire match into a pure function of `(seed, elapsed)`. That one refactor is the hinge:
- **Everyone sees the identical match** by broadcasting just `{seed, startEpochMs, goalScript}` over Supabase Realtime — zero per-frame network cost, stays inside the free tier.
- **The background-tab freeze becomes self-healing** — a refocused tab recomputes `elapsed` from wall-clock and fast-forwards the deterministic sim to the correct moment instead of freezing.
- **Join-in-progress, replays, and match reports** all fall out for free (a match = a tiny tuple).

The **second-biggest insight** is orthogonal and equally cheap: the cosmetic pitch and the authoritative scoreline are two disconnected models. A single shared **Dixon-Coles / xG scoreline model** (used by both `tournament.ts` for the result AND `match-sim.ts` for the shoot decision) fixes *outcome* realism (real football clusters at 1-0/2-1, draws are common, favourites lose to smash-and-grabs) so the numbers stop looking like coin-flips.

**North-star — what a believable, watched-live subs match should FEEL like.** It's 78'. Your drafted Brazil is clinging to a 2-1 lead you can *see* being defended — the block drops deep, they're killing time in the corner. 142 subs are watching the same second (a live count says so), and when the equaliser is ruled offside the crowd bed swells then exhales and an emote storm floods the pitch. The dots orient and lean like they have mass and eyes; passes curl, crosses loft with a shadow that grows; a pt-BR voice calls "POR CIMA!" on the near miss. The goal, when it comes at 89', is built — a cutback, a tap-in — not teleported, and it cuts to a 0.35× replay. You tab away, come back at full-time, and the match snaps to the right moment because everyone's on the same clock. It feels less like a screensaver and more like *we were all there.*

## How to read this

- **[ROADMAP.md](ROADMAP.md)** — prioritized fastest-improvement-first, plus an adversarial reality-check.
- **[ARCHITECTURE.md](ARCHITECTURE.md)** — recommended target architecture + the cheap-server verdict.

### Deep-dives (one per realism dimension)

- [01 · simulation-engine](01-simulation-engine.md)
- [02 · physics-ball](02-physics-ball.md)
- [03 · rendering-visuals](03-rendering-visuals.md)
- [04 · prediction-models](04-prediction-models.md)
- [05 · real-data](05-real-data.md)
- [06 · architecture-hosting](06-architecture-hosting.md)
- [07 · realtime-watched](07-realtime-watched.md)
- [08 · commentary-audio](08-commentary-audio.md)
- [09 · game-design](09-game-design.md)
