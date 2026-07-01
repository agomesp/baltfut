/**
 * The FIFA 2026 knockout bracket TOPOLOGY — one source of truth shared by the
 * AI simulation (`ai-palpite/simulate`) and the connector-line bracket layout.
 *
 * For each tie in a round (0-based) the two feeder tie NUMBERS (1-based) from the
 * previous round. Round-of-32 ties are numbered 1–16 by kickoff order; the pairs
 * are read off ESPN's real slot placeholders ("Round of 32 4 Winner", …). The
 * first quadrant interleaves (1–4, 3–6, 2–5) — it is NOT consecutive.
 */
export const R16_FROM_R32: readonly (readonly [number, number])[] = [
  [1, 4], [3, 6], [2, 5], [7, 8], [11, 12], [9, 10], [14, 16], [13, 15],
];
export const QF_FROM_R16: readonly (readonly [number, number])[] = [
  [1, 2], [5, 6], [3, 4], [7, 8],
];
export const SF_FROM_QF: readonly (readonly [number, number])[] = [[1, 2], [3, 4]];
export const FINAL_FROM_SF: readonly (readonly [number, number])[] = [[1, 2]];

/** Tie count per round: 32-avos, oitavas, quartas, semis, final. */
export const ROUND_SIZES = [16, 8, 4, 2, 1] as const;

// Feeders indexed by TARGET round (1 = R16 … 4 = final).
const FEEDERS_OF = [null, R16_FROM_R32, QF_FROM_R16, SF_FROM_QF, FINAL_FROM_SF] as const;

/**
 * Per-round display order (0-based original indices) that turns the interleaved
 * FIFA wiring into a planar bracket: after reordering, a round's cards `2k` and
 * `2k+1` are exactly the two feeders of the next round's card `k`. Walk the tree
 * from the final backwards so every parent's two children land adjacent.
 */
export function bracketRoundOrders(): number[][] {
  const orders: number[][] = [];
  orders[ROUND_SIZES.length - 1] = [0]; // final: a single tie
  for (let target = FEEDERS_OF.length - 1; target >= 1; target--) {
    const feeders = FEEDERS_OF[target]!;
    const order: number[] = [];
    for (const t of orders[target]) order.push(feeders[t][0] - 1, feeders[t][1] - 1);
    orders[target - 1] = order;
  }
  return orders;
}

/** Reorder one round's items into bracket order. Returns the input unchanged when
 *  the count doesn't match the round (mid-tournament / partial fixtures). */
export function toBracketOrder<T>(items: T[], round: number): T[] {
  if (items.length !== ROUND_SIZES[round]) return items;
  const order = bracketRoundOrders()[round];
  return order.map((i) => items[i]);
}
