import { describe, it, expect } from "vitest";
import { pointerBias } from "@/lib/champions/pointer";

describe("pointerBias", () => {
  it("maps the viewport to -1..1 with the centre at 0", () => {
    expect(pointerBias(0, 0, 1000, 500)).toEqual({ x: -1, y: -1 });
    expect(pointerBias(500, 250, 1000, 500)).toEqual({ x: 0, y: 0 });
    expect(pointerBias(1000, 500, 1000, 500)).toEqual({ x: 1, y: 1 });
  });

  it("maps each axis independently", () => {
    expect(pointerBias(750, 125, 1000, 500)).toEqual({ x: 0.5, y: -0.5 });
  });

  it("clamps a pointer dragged outside the viewport", () => {
    expect(pointerBias(-400, 900, 1000, 500)).toEqual({ x: -1, y: 1 });
  });

  it("reports centred on a zero-sized viewport instead of dividing into Infinity", () => {
    // An Infinity here would reach the DOM as an invalid transform.
    const bias = pointerBias(10, 10, 0, 0);
    expect(bias).toEqual({ x: 0, y: 0 });
    expect(Number.isFinite(bias.x) && Number.isFinite(bias.y)).toBe(true);
  });
});
