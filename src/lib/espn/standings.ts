import { z } from "zod";
import { DEFAULT_LEAGUE } from "@/lib/espn/client";

/** One row in a group table. */
export interface StandingRow {
  rank: number;
  code: string;
  name: string;
  played: number;
  /** Goal difference, pre-formatted with sign by ESPN, e.g. "+3". */
  gd: string;
  points: number;
  /** Top-2 (or ESPN "advance" note): qualifies for the knockout. */
  advanced: boolean;
}

export interface Group {
  /** "A".."L". */
  letter: string;
  /** "Group A". */
  name: string;
  rows: StandingRow[];
}

const statSchema = z.object({
  name: z.string(),
  displayValue: z.string().optional(),
  value: z.number().optional(),
});

const entrySchema = z.object({
  team: z.object({ abbreviation: z.string(), displayName: z.string() }),
  note: z.object({ description: z.string().optional() }).nullish(),
  stats: z.array(statSchema),
});

const groupSchema = z.object({
  name: z.string(),
  standings: z.object({ entries: z.array(entrySchema) }),
});

const rootSchema = z.object({ children: z.array(groupSchema) });

function statValue(stats: z.infer<typeof statSchema>[], name: string): string {
  const stat = stats.find((s) => s.name === name);
  return stat?.displayValue ?? (stat?.value != null ? String(stat.value) : "");
}

function letterFromName(name: string): string {
  const m = name.match(/Group\s+([A-Z0-9]+)/i);
  return m ? m[1].toUpperCase() : name;
}

export function parseStandings(raw: unknown): Group[] {
  const root = rootSchema.safeParse(raw);
  if (!root.success) return [];

  return root.data.children.map((g) => ({
    letter: letterFromName(g.name),
    name: g.name,
    rows: g.standings.entries.map((e, i) => ({
      rank: i + 1,
      code: e.team.abbreviation,
      name: e.team.displayName,
      played: Number.parseInt(statValue(e.stats, "gamesPlayed"), 10) || 0,
      gd: statValue(e.stats, "pointDifferential") || "0",
      points: Number.parseInt(statValue(e.stats, "points"), 10) || 0,
      advanced: /advanc/i.test(e.note?.description ?? "") || i < 2,
    })),
  }));
}

/** code -> group letter, for highlighting a followed team and labelling matches. */
export function teamGroupMap(groups: Group[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const g of groups) {
    for (const r of g.rows) map[r.code] = g.letter;
  }
  return map;
}

export function standingsUrl(league: string): string {
  return `https://site.api.espn.com/apis/v2/sports/soccer/${encodeURIComponent(
    league,
  )}/standings`;
}

export interface FetchStandingsOptions {
  league?: string;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}

export async function fetchStandings(
  options: FetchStandingsOptions = {},
): Promise<Group[]> {
  const league = options.league ?? DEFAULT_LEAGUE;
  const doFetch = options.fetchImpl ?? fetch;
  const res = await doFetch(standingsUrl(league), {
    signal: options.signal,
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(
      `ESPN standings request failed: ${res.status} ${res.statusText}`,
    );
  }
  const json: unknown = await res.json();
  return parseStandings(json);
}
