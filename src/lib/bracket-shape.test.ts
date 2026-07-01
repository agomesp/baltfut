import { describe, expect, it } from "vitest";
import {
  R16_FROM_R32,
  QF_FROM_R16,
  SF_FROM_QF,
  bracketRoundOrders,
  toBracketOrder,
  ROUND_SIZES,
} from "@/lib/bracket-shape";

describe("bracket-shape wiring", () => {
  it("keeps the real 2026 round-of-16 wiring (interleaved first quadrant)", () => {
    expect(R16_FROM_R32).toEqual([
      [1, 4], [3, 6], [2, 5], [7, 8], [11, 12], [9, 10], [14, 16], [13, 15],
    ]);
    expect(QF_FROM_R16).toEqual([[1, 2], [5, 6], [3, 4], [7, 8]]);
    expect(SF_FROM_QF).toEqual([[1, 2], [3, 4]]);
  });
});

describe("bracketRoundOrders", () => {
  const orders = bracketRoundOrders();

  it("orders every round so consecutive pairs feed the next tie", () => {
    // Final is a single tie; each earlier round doubles in size.
    expect(orders.map((o) => o.length)).toEqual([16, 8, 4, 2, 1]);
    // R16 laid out so QF groupings are adjacent: ties (0,1)->QF0, (4,5)->QF1, …
    expect(orders[1]).toEqual([0, 1, 4, 5, 2, 3, 6, 7]);
    // R32 laid out so each R16's two feeders are adjacent.
    expect(orders[0]).toEqual([0, 3, 2, 5, 10, 11, 8, 9, 1, 4, 6, 7, 13, 15, 12, 14]);
  });

  it("is a permutation of each round's indices", () => {
    orders.forEach((order, r) => {
      expect([...order].sort((a, b) => a - b)).toEqual(
        Array.from({ length: ROUND_SIZES[r] }, (_, i) => i),
      );
    });
  });

  it("places both feeders of each next-round tie in the same adjacent pair", () => {
    // After reordering, card i and its sibling (i^1) must feed floor(i/2).
    // Verify against the raw wiring for R32 -> R16.
    const r32 = orders[0];
    for (let k = 0; k < orders[1].length; k++) {
      const r16Tie = orders[1][k]; // original R16 index at bracket slot k
      const feeders = [r32[2 * k], r32[2 * k + 1]].map((i) => i + 1).sort((a, b) => a - b);
      const expected = [...R16_FROM_R32[r16Tie]].sort((a, b) => a - b);
      expect(feeders).toEqual(expected);
    }
  });
});

describe("toBracketOrder", () => {
  it("reorders a round's items by the bracket permutation", () => {
    const r16 = ["t0", "t1", "t2", "t3", "t4", "t5", "t6", "t7"];
    expect(toBracketOrder(r16, 1)).toEqual([
      "t0", "t1", "t4", "t5", "t2", "t3", "t6", "t7",
    ]);
  });

  it("returns the input untouched when the size doesn't match the round", () => {
    const partial = ["a", "b", "c"];
    expect(toBracketOrder(partial, 1)).toBe(partial);
  });
});
