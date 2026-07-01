import {
  buildKnockout,
  isPlaceholderTeam,
  matchShootout,
  type Group,
  type KnockoutColumn,
  type Match,
} from "@/lib/espn";
import { teamPower } from "@/lib/ai-palpite/power";
import {
  predictMatch,
  strongerCode,
  type ScorePalpite,
} from "@/lib/ai-palpite/predict";
import { simulateBracket, type BracketSim } from "@/lib/ai-palpite/simulate";

/** My predicted scoreline for one fixture. */
export interface MatchPalpite {
  match: Match;
  score: ScorePalpite;
}

/** One mata-mata tie, projected. `score`/`advances` are null while either side
 *  is still an undecided seed ("2º Grupo H"). */
export interface TieProjection {
  match: Match;
  score: ScorePalpite | null;
  /** Team code I back to go through. */
  advances: string | null;
}

export interface KnockoutProjection {
  slug: string;
  label: string;
  ties: TieProjection[];
}

/** A team with its power rating, for the champion pick + força ranking. */
export interface RankedTeam {
  code: string;
  name: string;
  power: number;
}

export interface AiPalpitesModel {
  /** Predicted scorelines for every upcoming (not-yet-started) fixture. */
  upcoming: MatchPalpite[];
  /** The real mata-mata columns, each tie annotated with my projection. */
  knockout: KnockoutProjection[];
  /** Fully-resolved bracket simulation (group positions → final), or empty
   *  columns when the mata-mata isn't drawn / standings are missing. */
  bracket: BracketSim;
  /** Who I back to lift the trophy: the simulated champion when the bracket is
   *  drawn, else the highest-rated side still alive. */
  champion: RankedTeam | null;
  /** Top sides still alive, by power — the força ranking. */
  ranking: RankedTeam[];
}

const KNOCKOUT_STAGES = new Set([
  "round-of-32",
  "round-of-16",
  "quarterfinals",
  "semifinals",
  "3rd-place-match",
  "final",
]);

function isDecided(team: Match["home"]): boolean {
  return !isPlaceholderTeam(team.name);
}

/** The code I back to advance a tie: the favored side, breaking a predicted draw
 *  by power (mata-mata can't end level). */
function tieWinner(match: Match, score: ScorePalpite): string {
  if (score.winner === "home") return match.home.abbreviation;
  if (score.winner === "away") return match.away.abbreviation;
  return strongerCode(match.home.abbreviation, match.away.abbreviation);
}

function projectKnockout(columns: KnockoutColumn[]): KnockoutProjection[] {
  return columns.map((col) => ({
    slug: col.slug,
    label: col.label,
    ties: col.matches.map((match) => {
      if (!isDecided(match.home) || !isDecided(match.away)) {
        return { match, score: null, advances: null };
      }
      const score = predictMatch(match.home.abbreviation, match.away.abbreviation);
      return { match, score, advances: tieWinner(match, score) };
    }),
  }));
}

/**
 * Teams knocked out of title contention: anyone who lost a finished knockout tie,
 * plus both sides of the 3rd-place match (they're already out of the final).
 */
function eliminatedCodes(matches: Match[]): Set<string> {
  const out = new Set<string>();
  for (const m of matches) {
    if (!m.stage || !KNOCKOUT_STAGES.has(m.stage) || m.state !== "post") continue;
    if (m.stage === "3rd-place-match") {
      out.add(m.home.abbreviation);
      out.add(m.away.abbreviation);
      continue;
    }
    const hs = m.homeScore ?? 0;
    const as = m.awayScore ?? 0;
    if (hs > as) out.add(m.away.abbreviation);
    else if (as > hs) out.add(m.home.abbreviation);
    else {
      // Level after 90'/AET → the penalty shootout decides who's out. ESPN now
      // exposes the tally; only when it's absent do we leave both alive.
      const so = matchShootout(m);
      if (so) out.add(so.winner === "home" ? m.away.abbreviation : m.home.abbreviation);
    }
  }
  return out;
}

/** Distinct, decided teams across all fixtures (placeholders excluded). */
function presentTeams(matches: Match[]): Map<string, string> {
  const teams = new Map<string, string>();
  for (const m of matches) {
    for (const t of [m.home, m.away]) {
      if (isDecided(t) && !teams.has(t.abbreviation)) {
        teams.set(t.abbreviation, t.name);
      }
    }
  }
  return teams;
}

/**
 * Build the full AI-palpites view model from live fixtures + group tables.
 * Deterministic: the same input always produces the same predictions.
 */
export function buildAiPalpites(
  matches: Match[],
  groups: Group[] = [],
): AiPalpitesModel {
  const upcoming: MatchPalpite[] = matches
    // Only fixtures with two decided teams — a knockout tie still on seeds
    // ("Group A 1st Place") can't be palpitado yet; it shows in the mata-mata.
    .filter((m) => m.state === "pre" && isDecided(m.home) && isDecided(m.away))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .map((match) => ({
      match,
      score: predictMatch(match.home.abbreviation, match.away.abbreviation),
    }));

  const knockout = projectKnockout(buildKnockout(matches));

  const eliminated = eliminatedCodes(matches);
  const ranking: RankedTeam[] = [...presentTeams(matches)]
    .filter(([code]) => !eliminated.has(code))
    .map(([code, name]) => ({ code, name, power: teamPower(code) }))
    .sort((a, b) => b.power - a.power || a.code.localeCompare(b.code));

  const bracket = simulateBracket(matches, groups);
  // The simulated champion is the sharper pick (it walks the real bracket); fall
  // back to the strongest side still alive when the mata-mata isn't drawn yet.
  const simChampion = bracket.champion
    ? { code: bracket.champion.code, name: bracket.champion.name, power: teamPower(bracket.champion.code) }
    : null;

  return {
    upcoming,
    knockout,
    bracket,
    champion: simChampion ?? ranking[0] ?? null,
    ranking: ranking.slice(0, 8),
  };
}
