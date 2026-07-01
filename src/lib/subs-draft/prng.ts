/**
 * Deterministic PRNG for the subs match/tournament sim — the A0 keystone.
 *
 * WHY: every RNG site used to call `Math.random()`, so a match could never be
 * replayed and two viewers watching the "same" game saw different plays/scores.
 * A seeded stream makes a match a pure function of its seed → replays, a shared
 * watch-along broadcast (send the seed, not every frame), and reproducible tests.
 *
 * `mulberry32` is a fast 32-bit generator with a full period and good spread —
 * more than enough for a football toy. It stays on the *authority* plane: keep
 * the seed + integer bookkeeping deterministic; float cosmetics may read it but
 * must never feed back into it.
 *
 * NOTE (cross-engine): single-engine replay (same browser/node) is bit-stable
 * here. True cross-engine bit-identity also needs the authority maths to avoid
 * transcendentals (`poisson()` still uses `Math.exp`); that fixed-point pass is
 * a later A0 step — this module is the seed source it will build on.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A non-deterministic 32-bit seed — the default when no seed is supplied, so
 * unseeded callers (the current UI, variety-seeking tests) keep behaving randomly. */
export const randInt32 = (): number => (Math.random() * 4294967296) >>> 0;
