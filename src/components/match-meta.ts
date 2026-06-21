import type { Match } from "@/lib/espn";
import { teamNamePt } from "@/lib/team-names";

export const teamLabel = (code: string, name: string) => teamNamePt(code, name);

export function groupLabelFor(m: Match, groupByTeam: Record<string, string>): string {
  const g = groupByTeam[m.home.abbreviation] ?? groupByTeam[m.away.abbreviation];
  return g ? `Grupo ${g}` : "";
}

export function rowTint(m: Match, followCode: string | null): string {
  if (!followCode) return "transparent";
  return m.home.abbreviation === followCode || m.away.abbreviation === followCode
    ? "var(--signal-tint)"
    : "transparent";
}

export function teamColor(
  code: string,
  followCode: string | null,
  base = "var(--ink)",
): string {
  return code === followCode ? "var(--signal-strong)" : base;
}
