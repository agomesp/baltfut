import { classifyPrediction } from "@/lib/votes/predictions";
import type { VoteEntry } from "@/lib/votes";

/**
 * The PLACAR view's three-tier palpite breakdown for a live (or finished) match:
 *   - winners: exact current-score matches ("CRAVOU O PLACAR"); when there are no
 *     exact hits yet on a LIVE match, the closest still-reachable palpites are
 *     promoted here labelled "A N GOL(S)" so the winners row is never empty.
 *   - open:    still mathematically reachable ("PODE GANHAR") — live only.
 *   - lost:    already passed / wrong on a finished match ("ERROU").
 *
 * On a finished match nothing is "reachable", so every non-exact palpite is lost.
 */
export type PalpiteBucket = "win" | "open" | "lost";

export interface LivePalpite extends VoteEntry {
  bucket: PalpiteBucket;
  /** Display label, e.g. "CRAVOU O PLACAR" | "A 1 GOL" | "PODE GANHAR" | "ERROU". */
  status: string;
  /** Goals away from the exact current score (0 = exact). Lower is closer. */
  distance: number;
}

export interface LivePalpiteBreakdown {
  winners: LivePalpite[];
  open: LivePalpite[];
  lost: LivePalpite[];
}

/** How many cards the featured "winners" row holds before overflow to the grid. */
const FEATURE_SLOTS = 2;

function goalsLabel(distance: number): string {
  return `A ${distance} GOL${distance === 1 ? "" : "S"}`;
}

export function classifyLivePalpites(
  entries: VoteEntry[],
  current: { home: number; away: number },
  final = false,
): LivePalpiteBreakdown {
  const scored = entries.map((e) => {
    const status = classifyPrediction(e, current);
    const distance =
      Math.abs(e.predHome - current.home) + Math.abs(e.predAway - current.away);
    return { entry: e, status, distance };
  });

  const exact = scored.filter((s) => s.status === "winning");
  const reachable = final ? [] : scored.filter((s) => s.status === "can");
  const gone = scored.filter(
    (s) => s.status === "losing" || (final && s.status === "can"),
  );

  reachable.sort((a, b) => a.distance - b.distance);

  const winners: LivePalpite[] = exact.map((s) => ({
    ...s.entry,
    bucket: "win",
    status: "CRAVOU O PLACAR",
    distance: s.distance,
  }));

  // Promote the closest reachable palpites to fill the featured row.
  const promote = Math.max(0, FEATURE_SLOTS - winners.length);
  const featured = reachable.slice(0, promote);
  for (const s of featured) {
    winners.push({
      ...s.entry,
      bucket: "win",
      status: goalsLabel(s.distance),
      distance: s.distance,
    });
  }

  const open: LivePalpite[] = reachable.slice(promote).map((s) => ({
    ...s.entry,
    bucket: "open",
    status: "PODE GANHAR",
    distance: s.distance,
  }));

  const lost: LivePalpite[] = gone.map((s) => ({
    ...s.entry,
    bucket: "lost",
    status: "ERROU",
    distance: s.distance,
  }));

  return { winners, open, lost };
}
