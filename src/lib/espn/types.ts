/**
 * Normalized soccer types used throughout the app. These are intentionally
 * decoupled from ESPN's raw response shape so the rest of the codebase never
 * depends on a third-party schema we don't control.
 */

export type MatchState = "pre" | "in" | "post";

export type Side = "home" | "away";

export interface MatchGoal {
  side: Side;
  /** e.g. "12'", "90'+2'". */
  clock: string;
  scorer: string;
  /** ESPN label, e.g. "Goal", "Goal - Header", "Penalty - Scored". */
  type: string;
  /** Goal scored against own team — credited to the opponent's side. */
  ownGoal: boolean;
  /** Scored from a penalty kick. */
  penalty: boolean;
}

export interface MatchCard {
  side: Side;
  /** e.g. "45'+2'". */
  clock: string;
  player: string;
  /** Yellow or (straight/second-yellow) red. */
  kind: "yellow" | "red";
}

export interface Team {
  /** ESPN team id (stable). */
  id: string;
  /** Full display name, e.g. "Brazil". */
  name: string;
  /** Short code, e.g. "BRA". */
  abbreviation: string;
  /** Crest URL, or null when ESPN omits it. */
  logo: string | null;
}

export interface Match {
  /** ESPN event id — the stable key a vote is attached to. */
  id: string;
  /** League slug we queried, e.g. "fifa.world". */
  league: string;
  /** ESPN season stage slug, e.g. "group-stage", "round-of-32", "final". Set by
   *  the parser; optional only because some test fixtures predate it. */
  stage?: string;
  /** e.g. "Brazil at Argentina". */
  name: string;
  /** e.g. "BRA @ ARG". */
  shortName: string;
  /** ISO kickoff timestamp. */
  startsAt: string;
  /** Lifecycle: not started / in progress / finished. */
  state: MatchState;
  /** Convenience flag: the match is in progress. */
  isLive: boolean;
  /** Human status, e.g. "FT", "62'", "6/22 - 6:00 PM". */
  statusDetail: string;
  /** Live game clock, e.g. "62'", else null. */
  displayClock: string | null;
  /** Venue city, e.g. "Mexico City"; null when ESPN omits it. */
  venue: string | null;
  home: Team;
  away: Team;
  /** Home goals; null before kickoff. */
  homeScore: number | null;
  /** Away goals; null before kickoff. */
  awayScore: number | null;
  /** Penalty-shootout tally for a knockout decided on penalties (ESPN's
   *  `shootoutScore`); null when the tie wasn't a shootout. The `homeScore`/
   *  `awayScore` above stay the level 90'/AET aggregate. Optional so existing
   *  Match fixtures/factories don't all need it; `parseScoreboard` always sets it
   *  (null when absent) and `matchShootout` treats null/undefined alike. */
  homeShootout?: number | null;
  awayShootout?: number | null;
  /** Goal events (scorers) for the live/finished detail view; [] when none. */
  goals: MatchGoal[];
  /** Booking events (yellow/red) for the detail view; [] when none. */
  cards: MatchCard[];
}
