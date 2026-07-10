// Deterministic AI-palpite core, in plain ESM so BOTH the browser app (via the
// TS re-exports in power.ts / predict.ts) and the Node cron script
// (scripts/ai-palpite-pull.mjs) can run the EXACT same model. Node can't import
// the app's `.ts` directly, and forking the 60-team power table would let the
// bot's *recorded* palpites silently drift from the *displayed* ones — so this is
// the single source the script reads, and `core.parity.test.ts` fails CI if it
// ever diverges from power.ts / predict.ts.
//
// Pure: no imports, no randomness, no globals. The same fixtures always yield the
// same palpites, which is what makes backfilling past matches (and recording a
// pick after the palpite window has closed) fair — there is no hindsight here,
// only fixed pre-tournament strength ratings.

/** Fallback rating for any side we haven't rated explicitly. */
export const BASE_POWER = 62;

/** My (the model's) read on each side's strength going into Copa do Mundo 2026. */
export const POWER = {
  // Top contenders
  FRA: 91, ESP: 90, ARG: 90, BRA: 89, ENG: 88, POR: 86,
  GER: 84, NED: 83, ITA: 82, URU: 81, BEL: 80, CRO: 80,
  // Strong
  COL: 78, MAR: 78, SUI: 75, USA: 75, DEN: 75, SEN: 74, MEX: 74,
  JPN: 74, SRB: 73, AUT: 73, UKR: 72, NOR: 72, CAN: 70,
  // Mid
  ECU: 72, KOR: 71, NGA: 71, TUR: 71, IRN: 71, POL: 70, EGY: 70,
  CIV: 70, CZE: 70, AUS: 69, PER: 69, SWE: 69, SCO: 69,
  ALG: 68, PAR: 68, GRE: 68, WAL: 68, TUN: 67, GHA: 67, CMR: 67,
  CHI: 67, BIH: 67, QAT: 66, IRL: 66, RSA: 66,
  // Developing / debutants
  KSA: 65, UZB: 65, CRC: 65, COD: 65, JAM: 64, PAN: 64, HON: 63,
  JOR: 63, IRQ: 63, NZL: 60, CPV: 60, HAI: 58, CUW: 57,
};

/** This side's power rating; `BASE_POWER` when the team isn't rated. */
export function teamPower(code) {
  return POWER[code] ?? BASE_POWER;
}

/** Is this team one with an explicit rating (vs. the generic fallback)? */
export function isRated(code) {
  return code in POWER;
}

function clampGoals(x) {
  return Math.max(0, Math.min(5, Math.round(x)));
}

/**
 * Deterministic scoreline from two power ratings. The rating gap tilts expected
 * goals toward the stronger side around a ~1.3-goal baseline; even matchups land
 * on a draw, and the spread is capped so nothing reads as an absurd blowout.
 * Returns `{ home, away, winner: "home"|"away"|"draw", confidence: 0..1 }`.
 */
export function predictScore(homePower, awayPower) {
  const gap = (homePower - awayPower) / 18;
  const home = clampGoals(1.3 + gap * 0.6);
  const away = clampGoals(1.3 - gap * 0.6);
  const winner = home > away ? "home" : away > home ? "away" : "draw";
  const confidence = Math.min(1, Math.abs(homePower - awayPower) / 30);
  return { home, away, winner, confidence };
}

/** Predicted scoreline for a fixture, by team code. */
export function predictMatch(homeCode, awayCode) {
  return predictScore(teamPower(homeCode), teamPower(awayCode));
}

/**
 * Who advances when a draw isn't allowed (mata-mata): the stronger side, with
 * the code tiebreak keeping it deterministic for two equally-rated teams.
 */
export function strongerCode(a, b) {
  const pa = teamPower(a);
  const pb = teamPower(b);
  if (pa !== pb) return pa > pb ? a : b;
  return a <= b ? a : b;
}
