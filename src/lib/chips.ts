import type { Match } from "@/lib/espn";
import { decideConcurrent } from "@/lib/concurrent-games";

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

/** One rail entry: a single game, or two currently co-shown concurrent games. */
export type ChipGroup = ChipGame[];

/**
 * Collapse the rail's chips so two games that are co-shown right now (per
 * `decideConcurrent`) render as ONE combined pill. Order is preserved and a
 * game is only ever in one group; finished games never merge. Recomputed as
 * `now` advances, so a pair forms/dissolves in step with the live stage.
 */
export function groupConcurrentChips(chips: ChipGame[], now: number): ChipGroup[] {
  const matches = chips.map((c) => c.match);
  const byId = new Map(chips.map((c) => [c.match.id, c] as const));
  const used = new Set<string>();
  const groups: ChipGroup[] = [];
  for (const chip of chips) {
    if (used.has(chip.match.id)) continue;
    used.add(chip.match.id);
    const partner = decideConcurrent(chip.match, matches, now).partner;
    const partnerChip = partner && !used.has(partner.id) ? byId.get(partner.id) : undefined;
    if (partnerChip) {
      used.add(partnerChip.match.id);
      groups.push([chip, partnerChip]);
    } else {
      groups.push([chip]);
    }
  }
  return groups;
}

/**
 * The match id a combined pill selects so the live stage shows it correctly:
 * the live game when present (→ live duo / mixed view), else the first.
 */
export function groupPrimaryId(group: ChipGroup): string {
  return (group.find((c) => c.phase === "live") ?? group[0]).match.id;
}

/** Default selected chip: a live game, else the next upcoming, else most recent. */
export function defaultChipId(chips: ChipGame[]): string | null {
  return (
    chips.find((c) => c.phase === "live")?.match.id ??
    chips.find((c) => c.phase === "pre")?.match.id ??
    (chips.length ? chips[chips.length - 1].match.id : null)
  );
}
