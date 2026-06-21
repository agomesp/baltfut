import type { VoteEntry } from "@/lib/votes/results";

export type PredictionStatus = "winning" | "can" | "losing";

export interface RankedPrediction extends VoteEntry {
  status: PredictionStatus;
}

/**
 * Classify a prediction against the current score (the design's core rule):
 *   - winning: predicted score == current score exactly
 *   - can:     still reachable (both predicted >= current), but not exact
 *   - losing:  current score already passed the prediction on either side
 */
export function classifyPrediction(
  pred: { predHome: number; predAway: number },
  current: { home: number; away: number },
): PredictionStatus {
  if (pred.predHome === current.home && pred.predAway === current.away) {
    return "winning";
  }
  if (pred.predHome >= current.home && pred.predAway >= current.away) {
    return "can";
  }
  return "losing";
}

const RANK: Record<PredictionStatus, number> = { winning: 0, can: 1, losing: 2 };

/**
 * Rank predictions winning -> can -> losing. Array.sort is stable in modern JS,
 * so the incoming order (newest first) is preserved within each status group.
 */
export function rankPredictions(
  entries: VoteEntry[],
  current: { home: number; away: number },
): RankedPrediction[] {
  return entries
    .map((e) => ({ ...e, status: classifyPrediction(e, current) }))
    .sort((a, b) => RANK[a.status] - RANK[b.status]);
}
