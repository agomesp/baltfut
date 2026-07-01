Grounding a believable match on real data, inside the project's hard constraints: **static GitHub Pages export + Supabase free tier + optional cheap server**. The current sim is a ~673-line cosmetic engine (`src/lib/subs-draft/match-sim.ts`) that already models possession FSM, momentum, pressing, set pieces and scripted goals — it looks like football but is *invented* football. The single biggest realism lever is to stop inventing and instead **replay a real match's spatial event stream**, and secondarily to **seed player attributes from real ratings**. Below, sources are inventoried, then upgrades are ranked by realism-payoff ÷ effort.

## Source inventory (browser-fetchability + licensing)

| Source | What it gives | Cost | CORS / access | ToS risk |
|---|---|---|---|---|
| **StatsBomb Open Data** (github.com/statsbomb/open-data) | ~3,400 events/match with x,y locations on a 120×80 pitch, lineups, **360 freeze-frames** (all 22 player positions at each shot). **All 64 matches of WC 2022 (with 360) and WC 2018** | Free | Static JSON on GitHub/`raw.githubusercontent.com` — **CORS-open, fetch direct or vendor into `public/`** | Non-commercial user agreement, **attribution + logo required**. Low risk if you credit them and keep it non-commercial (a sub game likely qualifies). |
| **ESPN site API** (current) | Live scores, scorers, lineups, standings, bracket | Free | Keyless, CORS-open, browser-direct (already wired in `src/lib/espn/`) | Undocumented/unofficial; stable in practice. Keep. |
| **API-Football** | Live + historical fixtures, lineups, events, some stats | Free 100 req/day; **$19+/mo** | Browser calls leak the key → **needs edge-function proxy** | Fine within plan. |
| **football-data.org** | Fixtures, standings, scorers (no spatial data) | Free tier (10 req/min) | Key-in-header → proxy | Low. |
| **TheSportsDB** | Team/player metadata, badges, headshots | Free (key `123`), $9/mo premium | Mixed CORS per endpoint | Community DB, thin player *ratings*. Good for **art/crests**, not physics. |
| **FBref / Sports-Reference** | Deep per-player stats, some xG | Free but **scrape-only, 10 req/min, bans bot traffic** | No CORS, no API | **Trap** — ToS-hostile, brittle, needs a scraper + cache. |
| **Understat** | Shot-level xG | Free but scrape-only (~8 req/min) | Embedded-JSON scrape, no CORS | Same trap; only worth it via an offline cache job. |
| **Sofifa / EA-FC (FIFA) ratings** | Per-player 0–99 attribute vectors (pace, passing, shooting, defending…) | Free to scrape / community CSV dumps exist | Scrape or vendored CSV | EA IP; safe as *seed weights* if you don't redistribute the raw DB. **High payoff for drafts.** |
| **Opta / Wyscout / Sportmonks** | Gold-standard tracking + events | Paid, ££££ | API | Out of budget. Ignore. |

## Ranked upgrades

### 1. Replay StatsBomb event streams as the on-pitch match — **the killer idea** (realism: huge; effort: M; client-only)
Instead of the rule engine *generating* play, drive the pitch from a real match's ~3,400 timestamped x,y events. Every pass origin→destination, carry, shot, and the goals are **real** — the geometry, tempo and shape are exactly what happened in a World Cup game. This is precisely how analytics visualisers (mplsoccer, StatsBomb's own IQ, the Friends-of-Tracking tutorials) render matches, and it's the difference between "plausible motion" and "this actually happened."

**How it fits the constraints:** vendor a handful of WC-2022 match JSONs into `public/data/sb/` at build time (they're a few MB each, static, CORS-irrelevant since same-origin). No server, no Supabase needed. Write a small adapter alongside `match-sim.ts` that exposes the *same* `MatchSim` interface (`step(dt)`, `snapshot()`), so the pitch renderer is untouched. Because events are discrete (~3/sec of ball action, not 25 fps tracking), you **interpolate** ball position between consecutive event locations with easing, and move the two involved players toward their event coords; the other 20 get positions from the **360 freeze-frame** at the nearest shot and are lerped between frames. This is exactly the "continuous tracking from discrete broadcast data" problem — a Catmull-Rom / cubic spline through event points plus constant-velocity infill is the standard, good-enough approximation.

**Tradeoff:** off-ball players between freeze-frames are still your best-guess (freeze-frames only exist at shots), so keep the existing flat-line/pressing heuristics to fill the 20 off-ball dots — hybrid, not pure replay. **This is the top pick: one match adapter unlocks documentary-grade realism with zero backend.**

### 2. Map the tournament's *scripted* scoreline onto a real-match template (realism: high; effort: S–M; client-only)
The bracket is authoritative (`tournament.ts` sets the scoreline). Today the sim fakes goals into a corner. Instead, pick a **real WC match with the same scoreline** (e.g. bracket says 2–1 → replay a real 2–1) and time-warp its goal events to the sim clock. You get real build-up play *and* the mandated result. Even without full event replay, a library of ~30 real "goal sequences" (shot origin, assist vector, keeper-beaten corner) sampled by scoreline makes every goal look organically built rather than teleported. Cheap, big immersion win. **Quick win.**

### 3. Seed draft player attributes from real ratings (realism: high for the *game layer*; effort: S; client-only)
Right now `rating` defaults to 78 and drives pace/passing/tackling. Vendor a **Sofifa/EA-FC attribute CSV** (pace, passing, shooting, defending, physical per player) into `public/data/ratings.json` and map draftable squad members to it. Suddenly Mbappé sprints and finishes, a journeyman doesn't — the draft *means* something and the sim's rating-driven accuracy produces believable skill gaps. This is how Football Manager and FIFA/EA-FC ground behaviour. Effort is small because the hooks already exist (`s.rating`, `pace` derived from rating); you're just replacing scalars with real vectors and letting the engine read `passing`/`shooting` separately. **Best payoff-per-hour.**

### 4. Real lineups, formations & crests from ESPN/StatsBomb (realism: medium; effort: S; client-only)
Use StatsBomb/ESPN lineup data (already parsed in `src/lib/espn/lineups.ts`) to seed real XIs and formations into the draft/pre-match, and TheSportsDB for real crests/kit colours on the dot tokens. Small but the "these are the real players in the real shape" cue lands immediately.

### 5. Live xG-driven shot outcomes (realism: medium; effort: M; needs Supabase cache)
Fit a tiny logistic xG model (distance, angle, header/foot, from StatsBomb's ~40k open shots — a well-trodden reproducible exercise) and let it decide save/goal probability so shot quality matches location. Client-only to *run*; the training is offline, ship the ~10 coefficients as constants. Modest realism gain over the current rating heuristic; do it after 1–3.

### 6. **Traps to avoid**
- **FBref/Understat live scraping from the browser** — no CORS, aggressive bans, brittle HTML. If you ever want their numbers, do it in a **scheduled Supabase edge function / GitHub Action that scrapes slowly and caches to a table**, never at request time. Not worth it for this game.
- **API-Football for historical spatial data** — it doesn't give event x,y at StatsBomb's fidelity; paying $19/mo buys you *less* realism than free StatsBomb JSON. Only reach for it if you need *live* current-tournament events the ESPN endpoint lacks.
- **Real-time tracking data** (25 fps) — only Opta/Second-Spectrum have it, it's paid and heavy. The interpolated-events approach (upgrade 1) is 95% of the visual payoff for 0% of the cost.

## Where things run — summary
- **Client-only (no backend):** #1 replay, #2 goal templates, #3 ratings, #4 lineups/crests, #5 xG scoring — all ship as vendored static JSON in `public/`, honouring `output: export`.
- **Supabase (only if scaling):** cache scraped xG/ratings, or store a curated match-template library if it grows past what you want in the bundle.
- **Cheap server:** genuinely unnecessary here — the whole realism jump is achievable statically. Reserve budget for the background-tab freeze (a separate concern) rather than data.

**Bottom line:** do #3 (ratings) and #2 (goal templates) first for a fast believability jump, then invest the M-days in #1 (StatsBomb event replay) — that single adapter, feeding the existing `MatchSim` interface, is what turns "a convincing fake" into "we're watching a real match together," entirely within the static + free-tier envelope, at the cost of a StatsBomb attribution line.

Sources: [statsbomb/open-data](https://github.com/statsbomb/open-data), [StatsBomb WC2022 release](https://blogarchive.statsbomb.com/news/statsbomb-release-free-2022-world-cup-data/), [API-Football pricing](https://www.api-football.com/pricing), [football-data.org pricing](https://www.football-data.org/pricing), [TheSportsDB docs](https://www.thesportsdb.com/documentation), [Sports-Reference bot policy](https://www.sports-reference.com/bot-traffic.html).
