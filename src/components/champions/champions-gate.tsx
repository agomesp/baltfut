"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { Match } from "@/lib/espn";
import { matchShootout } from "@/lib/espn";
import type { VoteEntry } from "@/lib/votes";
import type { BracketEntry } from "@/lib/bracket-votes";
import type { MatchResult } from "@/lib/ranking";
import { buildResultMap, useSubRanks } from "@/lib/use-sub-ranks";
import {
  bestAccuracyRanking,
  championsBoard,
  halfPointRanking,
  mostPalpitesRanking,
  userAccuracy,
  worstAccuracyRanking,
} from "@/lib/champions/rankings";
import { useMyName } from "@/lib/use-my-name";
import { ChampionsScreen } from "@/components/champions/champions-screen";
import { JB } from "@/components/live/bf-ui";

/**
 * Owns the closing ceremony: works out whether the final is done, computes every
 * board off the same graded data the live ranking uses, and flips the screen on
 * the moment the final ends.
 *
 * Once the final is over the ceremony IS the front page: it opens on the
 * transition for anyone watching live, AND on a cold load for anyone arriving
 * afterwards. It mounts fresh each time, so the whole reveal — podium climbing,
 * confetti, boards landing — replays on every visit rather than only for whoever
 * happened to be there at the whistle.
 *
 * "Ver partidas anteriores" dismisses it to the normal views and that sticks for
 * the rest of the page load; "ver ganhador" brings it back.
 */

/** Minimum palpites to qualify for the worst-accuracy board, so one unlucky
 *  guess can't top it. */
const MIN_PALPITES = 10;

/** Lower floor for the best-accuracy board: hitting exact scores is rare, so a
 *  10-palpite gate would leave it empty. Still enough to keep a lone 1-of-1 out. */
const MIN_BEST = 6;

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
  const best = useMemo(() => bestAccuracyRanking(allEntries, byId, MIN_BEST, 5), [allEntries, byId]);
  // The viewer's own hit rate, billed on the other side of the champion. Null
  // without a claimed nickname on this browser — a passer-by gets no badge.
  const myName = useMyName();
  const mine = useMemo(() => userAccuracy(allEntries, byId, myName), [allEntries, byId, myName]);

  // Open as soon as the final is finished — both for the room watching it end and
  // for someone loading the page hours later, who came to see who won rather than
  // a fixture list. Exactly ONCE per page load: dismissing it has to stick, or the
  // back button would be undone by the next data refresh.
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current || realWinner == null) return;
    opened.current = true;
    onOpen();
  }, [realWinner, onOpen]);

  if (!open || !winner) return null;
  return (
    <ChampionsScreen
      winnerCode={winner}
      board={board}
      half={half}
      volume={volume}
      accuracy={accuracy}
      best={best}
      mine={mine}
      minPalpites={MIN_PALPITES}
      minBest={MIN_BEST}
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

  // The "simulate the final" trigger is hidden behind `?simfinal` so it isn't
  // sitting in the masthead during normal local work — add the param to the URL to
  // bring it back when changing the ceremony. Same idea as `?mocklive` in page.tsx.
  // Read in an effect rather than during render, so the prerendered markup and the
  // hydrated client agree on the first paint.
  //
  // The NODE_ENV half is compared INLINE in the JSX below rather than folded in
  // here: the bundler substitutes it at build time, so an inline comparison makes
  // the whole branch statically dead and the button vanishes from the production
  // bundle. Behind a state variable it stays false at runtime but the markup ships.
  const [simfinalParam, setSimfinalParam] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSimfinalParam(new URLSearchParams(window.location.search).has("simfinal"));
  }, []);

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
      {canOpen ? (
        <button type="button" onClick={onOpen} style={btn("#ffd76a")}>
          🏆 VER GANHADOR
        </button>
      ) : null}
      {process.env.NODE_ENV === "development" && simfinalParam ? (
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
