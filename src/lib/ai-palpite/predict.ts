import { teamPower } from "@/lib/ai-palpite/power";

/** A predicted scoreline plus who I back to go through. */
export interface ScorePalpite {
  home: number;
  away: number;
  /** The side I favor, or null when I call it an even draw. */
  winner: "home" | "away" | "draw";
  /** 0–1: how lopsided the matchup is (drives the confidence bar). */
  confidence: number;
}

function clampGoals(x: number): number {
  return Math.max(0, Math.min(5, Math.round(x)));
}

/**
 * Deterministic scoreline from two power ratings. The rating gap tilts expected
 * goals toward the stronger side around a ~1.3-goal baseline; even matchups land
 * on a draw, and the spread is capped so nothing reads as an absurd blowout.
 */
export function predictScore(homePower: number, awayPower: number): ScorePalpite {
  const gap = (homePower - awayPower) / 18;
  const home = clampGoals(1.3 + gap * 0.6);
  const away = clampGoals(1.3 - gap * 0.6);
  const winner = home > away ? "home" : away > home ? "away" : "draw";
  const confidence = Math.min(1, Math.abs(homePower - awayPower) / 30);
  return { home, away, winner, confidence };
}

/** Predicted scoreline for a fixture, by team code. */
export function predictMatch(homeCode: string, awayCode: string): ScorePalpite {
  return predictScore(teamPower(homeCode), teamPower(awayCode));
}

/**
 * Who advances when a draw isn't allowed (mata-mata): the stronger side, with
 * the code tiebreak keeping it deterministic for two equally-rated teams.
 */
export function strongerCode(a: string, b: string): string {
  const pa = teamPower(a);
  const pb = teamPower(b);
  if (pa !== pb) return pa > pb ? a : b;
  return a <= b ? a : b;
}
