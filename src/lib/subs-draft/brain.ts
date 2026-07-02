// DEEPER THINKING — the sim's planning layer, as pure functions (no RNG, no sim
// state) so every piece is unit-testable and deterministic by construction:
//
//  · onwardValue()      — one-level pass LOOKAHEAD: how valuable is the receiver's
//                         best next action (shoot, or hit an open man further on)?
//                         Multiplied into pass scores, it makes the carrier play
//                         the pass BEFORE the pass — two-move structures emerge.
//  · pickOverloadFlank() — the work-it-wide team intention picks the emptier flank.
//  · coachAdjust()       — a deterministic "coach" reads scoreline + shot counts at
//                         halftime/60'/75' checkpoints and shifts the style pack
//                         (line height, press, directness, tempo). Urgency stays
//                         the per-play modulation; this is the STRUCTURAL shift.
export interface XY {
  x: number;
  y: number;
}

/**
 * How CLEAR a pass/shot lane is: the smallest perpendicular distance of any point
 * in `list` whose projection falls BETWEEN the endpoints. Large = an open lane; small
 * = a defender sitting in the pass. The utility AI uses this so passes "see" the
 * defence instead of firing blind. (Lives here — the pure layer — and is re-exported
 * by match-sim for older importers.)
 */
export function laneClearance(fx: number, fy: number, tx: number, ty: number, list: XY[]): number {
  const dx = tx - fx;
  const dy = ty - fy;
  const len2 = dx * dx + dy * dy || 1;
  const len = Math.sqrt(len2);
  let min = 99;
  for (const p of list) {
    const t = ((p.x - fx) * dx + (p.y - fy) * dy) / len2;
    if (t <= 0.05 || t >= 0.98) continue; // only bodies between the two points
    const perp = Math.abs((p.x - fx) * dy - (p.y - fy) * dx) / len;
    if (perp < min) min = perp;
  }
  return min;
}

/** Tactical deltas the coach lays over the team's base style pack. */
export interface CoachAdjust {
  lineDelta: number; // + = defend higher up the pitch
  pressDelta: number; // + = press trigger radius grows
  directDelta: number; // + = forward passes valued more
  tempoDelta: number; // + = quicker decisions, − = slow it down
}

export const COACH_ZERO: CoachAdjust = { lineDelta: 0, pressDelta: 0, directDelta: 0, tempoDelta: 0 };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * One-level lookahead: the value of the RECEIVER's best next action from (px, py).
 * Two candidate futures, take the better:
 *  · SHOOT — an xG-ish estimate (distance × angle × shot-lane clearance), the same
 *    shape decide() uses, so "he could finish from there" means what the sim means.
 *  · MOVE IT ON — the best forward outlet: a teammate ahead of the spot, weighted
 *    by how open he is (nearest opponent) and his own proximity to goal.
 * Bounded 0..1. Pure arithmetic — callers fold it into their option scores.
 */
export function onwardValue(px: number, py: number, attackGoal: XY, mates: XY[], opps: XY[]): number {
  const toGoal = py > attackGoal.y ? py - attackGoal.y : attackGoal.y - py; // |Δy| toward goal line
  const dg = Math.hypot(px - attackGoal.x, toGoal);
  const angle = 1 - Math.abs(px - 50) / 50;
  const distF = clamp(1 - (dg - 6) / 36, 0, 1);
  const shotLane = clamp(laneClearance(px, py, attackGoal.x, attackGoal.y, opps) / 6, 0, 1);
  const shootVal = distF * (0.35 + 0.65 * angle) * (0.25 + 0.75 * shotLane);

  const up = attackGoal.y > 50; // attacking toward y=100?
  let passVal = 0;
  for (const m of mates) {
    const ahead = up ? m.y - py : py - m.y;
    if (ahead <= 3) continue; // an onward option must PROGRESS
    let nearest = 99;
    for (const o of opps) {
      const d = Math.hypot(o.x - m.x, o.y - m.y);
      if (d < nearest) nearest = d;
    }
    const openness = clamp(nearest / 10, 0, 1);
    const mDg = Math.hypot(m.x - attackGoal.x, m.y - attackGoal.y);
    const threat = clamp(1 - (mDg - 8) / 55, 0.1, 1);
    const v = 0.55 * openness * (0.4 + 0.6 * threat);
    if (v > passVal) passVal = v;
  }

  return clamp(Math.max(shootVal, passVal), 0, 1);
}

/**
 * The work-it-wide intention targets the flank with FEWER defenders (central
 * bodies count for neither). Ties go left so the choice is deterministic.
 */
export function pickOverloadFlank(defenders: XY[]): "L" | "R" {
  let left = 0;
  let right = 0;
  for (const d of defenders) {
    if (d.x < 40) left++;
    else if (d.x > 60) right++;
  }
  return right < left ? "R" : "L";
}

/**
 * The coach's read at a checkpoint: goal difference (this side's perspective),
 * shots for/against, and match progress. Checkpoints live in the sim (halftime,
 * ~60', ~75', and after every goal) — this is only the pure mapping.
 *
 *  · losing after halftime → push: line up, press tighter, more direct, quicker
 *    (harder when 2+ down — desperation football is a real, visible thing)
 *  · winning from ~70'    → the shell: drop the line, save the legs, slow it down
 *  · level late but clearly OUT-SHOT → a modest push (the xG deficit says risk it)
 */
export function coachAdjust(goalDiff: number, shotsFor: number, shotsAgainst: number, progress: number): CoachAdjust {
  if (goalDiff < 0 && progress >= 0.5) {
    const two = goalDiff <= -2;
    return {
      lineDelta: two ? 5 : 3,
      pressDelta: two ? 0.7 : 0.4,
      directDelta: two ? 0.25 : 0.15,
      tempoDelta: two ? 0.1 : 0.06,
    };
  }
  if (goalDiff > 0 && progress >= 0.7) {
    // the shell is a LEAN, not a bunker: -4 line / -0.12 tempo strangled the whole
    // late economy (late-goal share collapsed) — real parked buses still concede
    return { lineDelta: -2.5, pressDelta: -0.4, directDelta: -0.08, tempoDelta: -0.08 };
  }
  if (goalDiff === 0 && progress >= 0.72 && shotsAgainst >= shotsFor + 6) {
    return { lineDelta: 2, pressDelta: 0.3, directDelta: 0.08, tempoDelta: 0.04 };
  }
  return COACH_ZERO;
}
