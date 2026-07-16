import type { Match } from "@/lib/espn";
import { matchShootout } from "@/lib/espn";
import {
  DOSSIERS,
  FINAL_THEME,
  THIRD_THEME,
  type Dossier,
  type PathLeg,
  type Scenario,
  type ShowpieceTheme,
} from "@/lib/showpiece/dossiers";

/**
 * Turns a REAL ESPN match into a showpiece {@link Scenario}, so the marquee
 * fixtures render the bespoke view driven by live data instead of mocks.
 *
 * ESPN tags the stage on `season.slug` (parse.ts → `Match.stage`), which is how we
 * recognise the two marquee ties. Everything measurable (the knockout path, the
 * goal tallies, the score/clock/kickoff) is derived from the real fixtures; only
 * the editorial bits a scoreboard can't know — nickname, craque, coach, colours,
 * tagline — stay curated in {@link DOSSIERS}.
 */

const STAGE_THEME: Record<string, ShowpieceTheme> = {
  final: FINAL_THEME,
  "3rd-place-match": THIRD_THEME,
};

/** Knockout rounds only — the group stage never appears in a "caminho". */
const ROUND_LABEL: Record<string, string> = {
  "round-of-32": "32-AVOS",
  "round-of-16": "OITAVAS",
  quarterfinals: "QUARTAS",
  semifinals: "SEMIFINAL",
  "3rd-place-match": "3º LUGAR",
  final: "FINAL",
};

/** The showpiece theme for a match, or null when it isn't a marquee fixture. */
export function showpieceThemeFor(match: Match): ShowpieceTheme | null {
  return STAGE_THEME[match.stage ?? ""] ?? null;
}

interface Leg {
  round: string;
  opp: string;
  own: number;
  against: number;
  won: boolean;
  pens: string;
}

/** A team's finished knockout ties, oldest first, from the team's own POV. */
function knockoutLegs(code: string, matches: Match[], excludeId?: string): Leg[] {
  return matches
    .filter(
      (x) =>
        x.id !== excludeId &&
        x.state === "post" &&
        x.homeScore != null &&
        x.awayScore != null &&
        ROUND_LABEL[x.stage ?? ""] != null &&
        (x.home.abbreviation === code || x.away.abbreviation === code),
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .map((x) => {
      const isHome = x.home.abbreviation === code;
      const own = (isHome ? x.homeScore : x.awayScore) as number;
      const against = (isHome ? x.awayScore : x.homeScore) as number;
      const so = matchShootout(x);
      return {
        round: ROUND_LABEL[x.stage ?? ""],
        opp: isHome ? x.away.abbreviation : x.home.abbreviation,
        own,
        against,
        // A shootout decides the tie; otherwise the 90'/AET scoreline does.
        won: so ? so.winner === (isHome ? "home" : "away") : own > against,
        pens: so ? ` (${isHome ? so.home : so.away}–${isHome ? so.away : so.home}p)` : "",
      };
    });
}

const toPathLeg = (l: Leg): PathLeg => ({
  round: l.round,
  opp: l.opp,
  score: `${l.own}–${l.against}${l.pens}`,
  won: l.won,
});

/** The team's real "caminho até aqui" — own score first, so an away leg still
 *  reads from their side. `excludeId` drops the tie currently being shown. */
export function realPath(code: string, matches: Match[], excludeId?: string): PathLeg[] {
  return knockoutLegs(code, matches, excludeId).map(toPathLeg);
}

/** Curated editorial dossier + the team's REAL knockout run and goal tallies. */
function buildDossier(code: string, matches: Match[], excludeId: string): Dossier | null {
  const base = DOSSIERS[code];
  if (!base) return null;
  const legs = knockoutLegs(code, matches, excludeId);
  return {
    ...base,
    path: legs.map(toPathLeg),
    koGoalsFor: legs.reduce((s, l) => s + l.own, 0),
    koGoalsAgainst: legs.reduce((s, l) => s + l.against, 0),
  };
}

/**
 * Build a showpiece Scenario from a real match. Null when the tie isn't a marquee
 * fixture, or when either side has no curated dossier (an unexpected finalist) —
 * the caller then falls back to the normal live view.
 */
export function scenarioFromMatch(match: Match, matches: Match[]): Scenario | null {
  const theme = showpieceThemeFor(match);
  if (!theme) return null;
  const home = buildDossier(match.home.abbreviation, matches, match.id);
  const away = buildDossier(match.away.abbreviation, matches, match.id);
  if (!home || !away) return null;
  return { key: `${theme.key}-${match.id}`, theme, match, home, away };
}
