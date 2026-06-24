import type { VoteEntry } from "@/lib/votes";

/**
 * "A Comunidade Palpita" — the home-win / draw / away-win split implied by the
 * submitted palpites for a match. Each palpite's predicted score is reduced to an
 * outcome (home wins / empate / away wins); the three percentages are rounded with
 * the largest-remainder method so they always sum to exactly 100 (when total > 0).
 */
export interface Consensus {
  home: number;
  draw: number;
  away: number;
  total: number;
  homePct: number;
  drawPct: number;
  awayPct: number;
}

/** Round shares to integer percentages that sum to 100 (largest remainder). */
function pctParts(counts: number[], total: number): number[] {
  if (total === 0) return counts.map(() => 0);
  const raw = counts.map((c) => (c / total) * 100);
  const out = raw.map(Math.floor);
  let remainder = 100 - out.reduce((a, b) => a + b, 0);
  const byFrac = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < byFrac.length && remainder > 0; k++) {
    out[byFrac[k].i] += 1;
    remainder -= 1;
  }
  return out;
}

export function communityConsensus(
  entries: Pick<VoteEntry, "predHome" | "predAway">[],
): Consensus {
  let home = 0;
  let draw = 0;
  let away = 0;
  for (const e of entries) {
    if (e.predHome > e.predAway) home += 1;
    else if (e.predHome < e.predAway) away += 1;
    else draw += 1;
  }
  const total = home + draw + away;
  const [homePct, drawPct, awayPct] = pctParts([home, draw, away], total);
  return { home, draw, away, total, homePct, drawPct, awayPct };
}
