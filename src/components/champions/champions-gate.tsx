"use client";

import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import type { Match } from "@/lib/espn";
import { matchShootout } from "@/lib/espn";
import type { VoteEntry } from "@/lib/votes";
import type { BracketEntry } from "@/lib/bracket-votes";
import type { MatchResult } from "@/lib/ranking";
import { buildResultMap, useSubRanks } from "@/lib/use-sub-ranks";
import {
  championsBoard,
  halfPointRanking,
  mostPalpitesRanking,
  worstAccuracyRanking,
} from "@/lib/champions/rankings";
import { ChampionsScreen } from "@/components/champions/champions-screen";
import { JB } from "@/components/live/bf-ui";

/**
 * Owns the closing ceremony: works out whether the final is done, computes every
 * board off the same graded data the live ranking uses, and flips the screen on
 * the moment the final ends.
 *
 * Auto-opens only on the TRANSITION to finished — landing on an already-finished
 * tournament shouldn't trap you behind the overlay; the "ver ganhador" button is
 * the way back in.
 */

/** Minimum palpites to qualify for the worst-accuracy board, so one unlucky
 *  guess can't top it. */
const MIN_PALPITES = 10;

/** Shootout-aware winner of a finished tie, else null. */
export function finishedWinner(m: Match | null): string | null {
  if (!m || m.state !== "post" || m.homeScore == null || m.awayScore == null) return null;
  const so = matchShootout(m);
  if (so) return so.winner === "home" ? m.home.abbreviation : m.away.abbreviation;
  if (m.homeScore === m.awayScore) return null;
  return m.homeScore > m.awayScore ? m.home.abbreviation : m.away.abbreviation;
}

export interface ChampionsGateProps {
  matches: Match[];
  allEntries: VoteEntry[];
  matchResults?: Record<string, MatchResult>;
  brackets?: BracketEntry[];
  /** Dev-only trigger: pretend the final just ended, with this winner. */
  simulatedWinner?: string | null;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}

export function ChampionsGate({
  matches,
  allEntries,
  matchResults,
  brackets,
  simulatedWinner = null,
  open,
  onOpen,
  onClose,
}: ChampionsGateProps) {
  const finalMatch = useMemo(() => matches.find((m) => m.stage === "final") ?? null, [matches]);
  const realWinner = finishedWinner(finalMatch);
  const winner = simulatedWinner ?? realWinner;

  const byId = useMemo(() => buildResultMap(matches, matchResults), [matches, matchResults]);
  const ranks = useSubRanks(allEntries, matches, matchResults, brackets);

  const board = useMemo(() => championsBoard(ranks, 10), [ranks]);
  const half = useMemo(() => halfPointRanking(allEntries, byId), [allEntries, byId]);
  const volume = useMemo(() => mostPalpitesRanking(allEntries, byId, 5), [allEntries, byId]);
  const accuracy = useMemo(
    () => worstAccuracyRanking(allEntries, byId, MIN_PALPITES, 5),
    [allEntries, byId],
  );

  // Fire only when the final CROSSES into finished during this session.
  const seenFinished = useRef<boolean | null>(null);
  useEffect(() => {
    const done = realWinner != null;
    if (seenFinished.current === null) {
      seenFinished.current = done; // first observation — don't auto-open
      return;
    }
    if (done && !seenFinished.current) onOpen();
    seenFinished.current = done;
  }, [realWinner, onOpen]);

  if (!open || !winner) return null;
  return (
    <ChampionsScreen
      winnerCode={winner}
      board={board}
      half={half}
      volume={volume}
      accuracy={accuracy}
      minPalpites={MIN_PALPITES}
      onBack={onClose}
    />
  );
}

const btn = (accent: string): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 11px",
  borderRadius: 9,
  border: `1px solid ${accent}`,
  background: `${accent}1f`,
  color: accent,
  fontFamily: JB,
  fontSize: 9.5,
  letterSpacing: "0.08em",
  cursor: "pointer",
  whiteSpace: "nowrap",
});

/** The way back into the ceremony, plus a dev-only "pretend the final ended". */
export function ChampionsButtons({
  matches,
  canOpen,
  onOpen,
  onSimulate,
}: {
  matches: Match[];
  canOpen: boolean;
  onOpen: () => void;
  onSimulate: (winner: string) => void;
}) {
  const finalMatch = useMemo(() => matches.find((m) => m.stage === "final") ?? null, [matches]);
  const isDev = process.env.NODE_ENV === "development";

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
      {canOpen ? (
        <button type="button" onClick={onOpen} style={btn("#ffd76a")}>
          🏆 VER GANHADOR
        </button>
      ) : null}
      {isDev ? (
        <button
          type="button"
          title="Dev: simula o fim da final com um campeão aleatório"
          onClick={() => {
            const sides = finalMatch
              ? [finalMatch.home.abbreviation, finalMatch.away.abbreviation]
              : ["ARG", "ESP"];
            onSimulate(sides[Math.floor(Math.random() * sides.length)]);
          }}
          style={btn("#c8ff2d")}
        >
          ▶ SIMULAR FINAL
        </button>
      ) : null}
    </div>
  );
}
