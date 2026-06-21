/**
 * Normalized soccer types used throughout the app. These are intentionally
 * decoupled from ESPN's raw response shape so the rest of the codebase never
 * depends on a third-party schema we don't control.
 */

export type MatchState = "pre" | "in" | "post";

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
  home: Team;
  away: Team;
  /** Home goals; null before kickoff. */
  homeScore: number | null;
  /** Away goals; null before kickoff. */
  awayScore: number | null;
}
