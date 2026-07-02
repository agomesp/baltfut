// PLAYER KINEMATICS — pure movement-physics helpers that end the "hockey air-bot"
// feel: players carry momentum through TURNS (speed-scaled turn-rate clamp), brake
// before reversing (plant-and-cut), and split one rating into a deterministic
// per-player profile {topSpeed, accel, agility, reaction, strength} via the id
// hash — a winger and a centre-back at the same rating MOVE differently, in every
// match, with zero new data. All pure functions: no RNG, no sim state.

/** FNV-1a over a string → 0..1. Identity that is a pure function of the id, NOT the
 * match seed/stream — so a player behaves like HIMSELF in every match. (The single
 * source — match-sim imports this.) */
export function hash01(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967295;
}

export interface KinAttrs {
  /** multiplier on the rating-derived base pace (0.94..1.06) */
  topSpeedF: number;
  /** multiplier on the base acceleration (0.85..1.15) */
  accelF: number;
  /** max turn rate, rad/s at low speed (~4.8..11.3; speed scales it down) */
  agility: number;
  /** delay before reacting to a change of play, seconds (0.12..0.42) */
  reaction: number;
  /** duel/jostle weight (0.8..1.2) — consumed by the shielding mechanics */
  strength: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function deriveAttrs(id: string, rating: number): KinAttrs {
  return {
    topSpeedF: 0.94 + 0.12 * hash01(id + "ts"),
    accelF: 0.85 + 0.3 * hash01(id + "ac"),
    agility: 5 + 4.5 * hash01(id + "ag") + clamp((rating - 70) / 12, -1, 1.6),
    reaction: clamp(0.34 - (rating - 70) / 250 - 0.14 * hash01(id + "re"), 0.12, 0.42),
    strength: 0.8 + 0.4 * hash01(id + "st"),
  };
}

/**
 * Clamp a steering update by TURN physics: `(vx,vy)` is the current velocity,
 * `(nvx,nvy)` the accel-clamped velocity steer() wants. Slow players pivot freely;
 * at speed the heading may only rotate `agility × speedScale × dt` per tick (fast =
 * wide arcs), and a genuine reversal (>~120°) BRAKES first — the plant-and-cut.
 */
export function applyTurn(vx: number, vy: number, nvx: number, nvy: number, agility: number, dt: number): { vx: number; vy: number } {
  const sp = Math.hypot(vx, vy);
  if (sp < 4) return { vx: nvx, vy: nvy }; // near-stationary: turning in place is free
  const cur = Math.atan2(vy, vx);
  const want = Math.atan2(nvy, nvx);
  let dA = want - cur;
  if (dA > Math.PI) dA -= 2 * Math.PI;
  else if (dA < -Math.PI) dA += 2 * Math.PI;
  if (Math.abs(dA) > 2.1 && sp > 8) {
    // plant-and-cut: kill speed on the current line; the turn happens once slow
    const b = Math.max(0, 1 - 3.2 * dt);
    return { vx: vx * b, vy: vy * b };
  }
  const speedF = clamp(1 - (sp - 4) / 26, 0.35, 1); // sprinting arcs wide
  const maxT = agility * speedF * dt;
  if (Math.abs(dA) <= maxT) return { vx: nvx, vy: nvy };
  const a2 = cur + Math.sign(dA) * maxT;
  const nsp = Math.hypot(nvx, nvy);
  return { vx: Math.cos(a2) * nsp, vy: Math.sin(a2) * nsp };
}

/** Quantize a heading (radians, atan2 convention) to 8 sectors: 0=+x (right), 1=NE,
 * 2=+y (away/up-field), … CCW. The renderer draws bodies facing the sector. */
export function sector8(heading: number): number {
  const s = Math.round(heading / (Math.PI / 4));
  return ((s % 8) + 8) % 8;
}

/**
 * SHIELDING: how much of a tackle survives the carrier's body. Inputs are the
 * carrier→ball vector and the carrier→tackler vector; when the tackler is on the
 * BALL side (aligned, cos≈1) the challenge is clean (1); when the carrier's body
 * is between him and the ball (opposed, cos≈-1) the tackle is throttled to the
 * floor (0.45) — he'd have to go through the man. Pure geometry, no RNG.
 */
export function shieldFactor(ballDx: number, ballDy: number, tacklerDx: number, tacklerDy: number): number {
  const bl = Math.hypot(ballDx, ballDy);
  const tl = Math.hypot(tacklerDx, tacklerDy);
  if (bl < 1e-6 || tl < 1e-6) return 1; // degenerate — no shield to speak of
  const align = (ballDx * tacklerDx + ballDy * tacklerDy) / (bl * tl); // 1 ball-side … -1 shielded
  return clamp(0.45 + 0.55 * (align + 1) / 2, 0.45, 1);
}
