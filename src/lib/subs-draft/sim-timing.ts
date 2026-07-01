// Shared sim-timing constants — a tiny pure leaf module so BOTH the client clock
// (sim-clock.ts, the views) and the pure sim/tournament layer can agree on the
// cadence without the pure lib importing client code.
//
// The whole A0.2 authority story rests on a FIXED timestep: a match is played as
// TOTAL_STEPS fixed ticks, and a headless scoring run must use the exact same
// FIXED_DT × TOTAL_STEPS as the live spotlight so "the match you watched produced
// the score" is bit-exact.
export const FIXED_DT = 1 / 60; // authority tick — 60 Hz
export const SECS_PER_MATCH = 60; // a match plays 0'→90' over this many wall seconds at 1×
export const TOTAL_STEPS = Math.round(SECS_PER_MATCH / FIXED_DT); // 3600 fixed steps per match
