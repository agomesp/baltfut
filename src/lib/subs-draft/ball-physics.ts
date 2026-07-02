// MAGNUS — pure spin aerodynamics for the ball (the sim integrates it per step).
// A spinning ball accelerates PERPENDICULAR to its velocity: positive spin curls
// LEFT of travel (90° CCW), magnitude ∝ spin × speed. This is what makes corners
// swing in, crosses whip, and switches fade — the single most recognizable piece
// of real ball behavior. Pure arithmetic: no RNG, no state.

/** Curl strength: at |v|≈70 and spin 0.7, ~5-8 units of lateral drift over a
 * corner-length flight — visible whip without boomerangs. */
export const K_MAGNUS = 0.45;

/** How fast spin bleeds off in flight (s⁻¹) — half-life ~1.4s, outlasting most
 * deliveries so the curl holds to the far post. */
export const SPIN_DECAY = 0.5;

export function magnusAccel(vx: number, vy: number, spin: number): { ax: number; ay: number } {
  if (spin === 0 || (vx === 0 && vy === 0)) return { ax: 0, ay: 0 };
  // 90° CCW of (vx, vy) is (-vy, vx); |a| = K · spin · |v| — so a = K · spin · (-vy, vx)
  return { ax: -vy * K_MAGNUS * spin, ay: vx * K_MAGNUS * spin };
}

export function spinDecay(spin: number, dt: number): number {
  return spin * Math.exp(-SPIN_DECAY * dt);
}

/**
 * The spin SIGN that curls a ball moving along (vx, vy) toward a target sitting
 * at (tx, ty) RELATIVE to the ball: +1 when the target is left of the velocity
 * (positive spin curls left), else -1. Used to aim inswingers at the goalmouth.
 */
export function curlSign(vx: number, vy: number, tx: number, ty: number): 1 | -1 {
  return vx * ty - vy * tx > 0 ? 1 : -1;
}
