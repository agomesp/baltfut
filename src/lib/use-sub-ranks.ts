"use client";

import { useMemo } from "react";
import type { Match } from "@/lib/espn";
import { buildKnockout } from "@/lib/espn";
import type { VoteEntry } from "@/lib/votes";
import type { BracketEntry } from "@/lib/bracket-votes";
import { rankSubs, bracketPointsByUser, type MatchResult, type SubRank } from "@/lib/ranking";

/**
 * The Ranking dos Subs rows, assembled once: ESPN matches for live truth,
 * OVERRIDDEN by the durable `match_results` snapshots for finished games (so an
 * ESPN outage can't erase wins), with bracket points (0.2/correct winner) folded
 * in. Every surface that shows the ranking uses this, so none can silently drop
 * an input — a real regression once shipped that way.
 */
export function useSubRanks(
  entries: VoteEntry[],
  matches: Match[],
  results?: Record<string, MatchResult>,
  brackets?: BracketEntry[],
): SubRank[] {
  const byId = useMemo(() => {
    const m: Record<string, MatchResult> = {};
    for (const x of matches) m[x.id] = x;
    if (results) for (const id in results) m[id] = results[id];
    return m;
  }, [matches, results]);

  const bracketPoints = useMemo(
    () => bracketPointsByUser(brackets ?? [], buildKnockout(matches)),
    [brackets, matches],
  );

  return useMemo(() => rankSubs(entries, byId, bracketPoints), [entries, byId, bracketPoints]);
}
