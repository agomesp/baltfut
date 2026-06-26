import {
  buildKnockout,
  isPlaceholderTeam,
  type KnockoutColumn,
  type Match,
} from "@/lib/espn";
import { teamPower } from "@/lib/ai-palpite/power";
import {
  predictMatch,
  strongerCode,
  type ScorePalpite,
} from "@/lib/ai-palpite/predict";

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
  /** Who I back to lift the trophy (highest-rated side still alive). */
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
    // Level after 90' is decided on penalties ESPN doesn't expose here; leave
    // both alive rather than guess the wrong side out.
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
 * Build the full AI-palpites view model from live fixtures. Deterministic: the
 * same matches always produce the same predictions.
 */
export function buildAiPalpites(matches: Match[]): AiPalpitesModel {
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

  return {
    upcoming,
    knockout,
    champion: ranking[0] ?? null,
    ranking: ranking.slice(0, 8),
  };
}
