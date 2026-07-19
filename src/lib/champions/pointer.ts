/**
 * Pointer position → a -1..1 bias on each axis, which the champions screen feeds
 * into its 3D tilt (-1 = left/top edge, 0 = centre, 1 = right/bottom).
 *
 * Split out from the component because it's the only part of the effect worth
 * asserting on: the spring that smooths it is framer-motion's, but a bad number
 * here becomes a bad CSS transform. A zero-sized viewport would divide into
 * Infinity and render an invalid transform, so degenerate sizes report centred.
 */
export interface PointerBias {
  x: number;
  y: number;
}

const clamp = (n: number) => (n < -1 ? -1 : n > 1 ? 1 : n);

export function pointerBias(
  clientX: number,
  clientY: number,
  width: number,
  height: number,
): PointerBias {
  return {
    x: width > 0 ? clamp((clientX / width) * 2 - 1) : 0,
    y: height > 0 ? clamp((clientY / height) * 2 - 1) : 0,
  };
}
