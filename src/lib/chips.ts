import type { Match } from "@/lib/espn";

export type ChipPhase = "pre" | "live" | "post";

export interface ChipGame {
  match: Match;
  votes: number;
  phase: ChipPhase;
}

export interface BuildChipsOptions {
  /** How many recent finished-with-palpites games to surface. */
  pastLimit?: number;
  /** How many upcoming games to surface. */
  upcomingLimit?: number;
}

function phaseOf(m: Match): ChipPhase {
  if (m.isLive) return "live";
  return m.state === "post" ? "post" : "pre";
}

/**
 * The carousel's games: recent finished matches that have palpites, then the
 * live matches, then the next upcoming matches — left (older) to right (newer).
 */
export function buildChipGames(
  matches: Match[],
  voteCounts: Record<string, number>,
  { pastLimit = 12, upcomingLimit = 12 }: BuildChipsOptions = {},
): ChipGame[] {
  const live = matches.filter((m) => m.isLive);

  const finishedWithPalpites = matches
    .filter((m) => m.state === "post" && (voteCounts[m.id] ?? 0) > 0)
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt)) // most recent first
    .slice(0, pastLimit)
    .reverse(); // then chronological (oldest left)

  const upcoming = matches
    .filter((m) => m.state === "pre")
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, upcomingLimit);

  return [...finishedWithPalpites, ...live, ...upcoming].map((m) => ({
    match: m,
    votes: voteCounts[m.id] ?? 0,
    phase: phaseOf(m),
  }));
}

/** Default selected chip: a live game, else the next upcoming, else most recent. */
export function defaultChipId(chips: ChipGame[]): string | null {
  return (
    chips.find((c) => c.phase === "live")?.match.id ??
    chips.find((c) => c.phase === "pre")?.match.id ??
    (chips.length ? chips[chips.length - 1].match.id : null)
  );
}
