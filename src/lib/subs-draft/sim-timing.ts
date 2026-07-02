// Shared sim-timing constants — a tiny pure leaf module so BOTH the client clock
// (sim-clock.ts, the views) and the pure sim/tournament layer can agree on the
// cadence without the pure lib importing client code.
//
// The whole A0.2 authority story rests on a FIXED timestep: a match is played as
// TOTAL_STEPS fixed ticks, and a headless scoring run must use the exact same
// FIXED_DT × TOTAL_STEPS as the live spotlight so "the match you watched produced
// the score" is bit-exact.
export const FIXED_DT = 1 / 60; // authority tick — 60 Hz
// 3-minute matches (adopted 2026-07-02, was 60s): 30× compression instead of 90×.
// FIFA's lesson — compress the CLOCK, not the physics: at 180s plays unfold at
// near-natural speed (readable build-ups, real hang times, ~3× the on-ball
// decisions), and the 60s-era rate hacks became removable. The whole economy was
// re-tuned + the calibration gates re-anchored at this clock; 16× playback keeps
// the old skim speed (a full match in ~11s).
export const SECS_PER_MATCH = 180;
export const TOTAL_STEPS = Math.round(SECS_PER_MATCH / FIXED_DT); // 3600 fixed steps per match
