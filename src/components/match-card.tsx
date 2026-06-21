import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Match } from "@/lib/espn";
import type { VoteResult } from "@/lib/votes/results";

export interface MatchCardProps {
  match: Match;
  result?: VoteResult | null;
  /** Slot for a vote form or other actions. */
  children?: ReactNode;
}

function StatusBadge({ match }: { match: Match }) {
  if (match.isLive) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-600">
        <span
          className="size-1.5 animate-pulse rounded-full bg-red-500"
          aria-hidden
        />
        <span>LIVE</span>
        {match.displayClock ? (
          <span className="tabular-nums">{match.displayClock}</span>
        ) : null}
      </span>
    );
  }
  return (
    <span className="text-xs text-muted-foreground">{match.statusDetail}</span>
  );
}

function TeamRow({
  name,
  score,
  showScore,
  winner,
}: {
  name: string;
  score: number | null;
  showScore: boolean;
  winner: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={cn("truncate", winner && "font-semibold")}>{name}</span>
      <span className="tabular-nums text-lg font-semibold">
        {showScore ? score : "—"}
      </span>
    </div>
  );
}

function CrowdTally({
  result,
  homeAbbr,
  awayAbbr,
}: {
  result: VoteResult;
  homeAbbr: string;
  awayAbbr: string;
}) {
  const { totalVotes, homeVotes } = result;
  const homePct = totalVotes ? Math.round((homeVotes / totalVotes) * 100) : 0;
  const awayPct = totalVotes ? 100 - homePct : 0;
  return (
    <div className="flex flex-col gap-1 border-t pt-3 text-xs text-muted-foreground">
      <div className="flex items-center justify-between">
        <span>
          {homeAbbr} {homePct}%
        </span>
        <span>{totalVotes} votes</span>
        <span>
          {awayAbbr} {awayPct}%
        </span>
      </div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="bg-foreground/70" style={{ width: `${homePct}%` }} />
      </div>
    </div>
  );
}

export function MatchCard({ match, result, children }: MatchCardProps) {
  const { home, away, state } = match;
  const showScore =
    state !== "pre" && match.homeScore !== null && match.awayScore !== null;
  const homeWins = showScore && (match.homeScore ?? 0) > (match.awayScore ?? 0);
  const awayWins = showScore && (match.awayScore ?? 0) > (match.homeScore ?? 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="truncate">
            {match.name || match.shortName}
          </CardTitle>
          <StatusBadge match={match} />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <TeamRow
          name={home.name}
          score={match.homeScore}
          showScore={showScore}
          winner={homeWins}
        />
        <TeamRow
          name={away.name}
          score={match.awayScore}
          showScore={showScore}
          winner={awayWins}
        />
        {result && result.totalVotes > 0 ? (
          <CrowdTally
            result={result}
            homeAbbr={home.abbreviation}
            awayAbbr={away.abbreviation}
          />
        ) : null}
        {children}
      </CardContent>
    </Card>
  );
}
