/**
 * The "AI" behind the AI palpites: a fixed power rating (0–100) per national team,
 * my (the model's) read on each side's strength going into Copa do Mundo 2026.
 * Everything downstream — predicted scorelines, the projected mata-mata and the
 * champion pick — is derived deterministically from these numbers, so the same
 * fixtures always yield the same palpites (no server, no randomness).
 *
 * Unlisted sides fall back to `BASE_POWER`, so any team ESPN returns still gets a
 * sensible (if humble) rating.
 */
export const BASE_POWER = 62;

const POWER: Record<string, number> = {
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
export function teamPower(code: string): number {
  return POWER[code] ?? BASE_POWER;
}

/** Is this team one I've given an explicit rating (vs. the generic fallback)? */
export function isRated(code: string): boolean {
  return code in POWER;
}
