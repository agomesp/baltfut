import type { Match } from "@/lib/espn/types";

/** Knockout stage slugs ESPN uses, in bracket order. */
const STAGE_ORDER = [
  "round-of-32",
  "round-of-16",
  "quarterfinals",
  "semifinals",
  "3rd-place-match",
  "final",
] as const;

const STAGE_LABEL: Record<string, string> = {
  "round-of-32": "32-avos",
  "round-of-16": "Oitavas",
  quarterfinals: "Quartas",
  semifinals: "Semifinais",
  "3rd-place-match": "3º lugar",
  final: "Final",
};

export interface KnockoutColumn {
  slug: string;
  label: string;
  matches: Match[];
}

/**
 * Real knockout bracket from ESPN's fixtures. The knockout matches already live
 * in the scoreboard (tagged by `stage` = season slug), with real teams where the
 * slot is decided and placeholders ("Group H 2nd Place", "Round of 32 1 Winner")
 * where not. Groups them into ordered columns and drops empty stages.
 */
export function buildKnockout(matches: Match[]): KnockoutColumn[] {
  return STAGE_ORDER.map((slug) => ({
    slug,
    label: STAGE_LABEL[slug],
    matches: matches
      .filter((m) => m.stage === slug)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
  })).filter((col) => col.matches.length > 0);
}

/** A slot is a placeholder ("Group H 2nd Place", "Round of 32 1 Winner") rather
 *  than a decided team — these resolve as the tournament progresses. */
export function isPlaceholderTeam(name: string): boolean {
  return /\b(Group|Place|Winner|Loser|Round of|Quarterfinal|Semifinal|Third)\b/i.test(name);
}

/** Short pt-BR label for a placeholder slot's ESPN name. Returns the input
 *  unchanged when it doesn't match a known pattern (incl. a real team name). */
export function seedLabel(name: string): string {
  let m: RegExpMatchArray | null;
  if ((m = name.match(/^Group ([A-L]) (\d+)(?:st|nd|rd|th) Place$/i))) return `${m[2]}º Grupo ${m[1]}`;
  if ((m = name.match(/^Group ([A-L]) Winner$/i))) return `1º Grupo ${m[1]}`;
  if ((m = name.match(/^Third Place Group ([A-Z/]+)$/i))) return `3º (${m[1]})`;
  if ((m = name.match(/^Round of 32 (\d+) Winner$/i))) return `Venc. 32-avos ${m[1]}`;
  if ((m = name.match(/^Round of 16 (\d+) Winner$/i))) return `Venc. oitavas ${m[1]}`;
  if ((m = name.match(/^Quarterfinal (\d+) Winner$/i))) return `Venc. quartas ${m[1]}`;
  if ((m = name.match(/^Semifinal (\d+) Winner$/i))) return `Venc. semi ${m[1]}`;
  if ((m = name.match(/^Semifinal (\d+) Loser$/i))) return `Perd. semi ${m[1]}`;
  return name;
}
