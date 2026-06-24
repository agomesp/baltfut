import type { Match } from "@/lib/espn";

/** "Grupo X" for a match, from the team→group map (empty when unknown). */
export function groupLabelFor(m: Match, groupByTeam: Record<string, string>): string {
  const g = groupByTeam[m.home.abbreviation] ?? groupByTeam[m.away.abbreviation];
  return g ? `Grupo ${g}` : "";
}
