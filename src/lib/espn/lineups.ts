import { z } from "zod";
import { DEFAULT_LEAGUE } from "@/lib/espn/client";
import type { Side } from "@/lib/espn/types";

export interface LineupPlayer {
  number: string;
  /** GK / DF / MF / FW. */
  pos: string;
  name: string;
}

export interface TeamLineup {
  side: Side;
  code: string;
  formation: string;
  players: LineupPlayer[];
}

export interface MatchSub {
  side: Side;
  /** e.g. "62'". */
  clock: string;
  playerIn: string;
  playerOut: string;
}

export interface MatchLineups {
  home: TeamLineup;
  away: TeamLineup;
  /** Substitutions in chronological order; [] when none / unavailable. */
  subs: MatchSub[];
}

const playerSchema = z.object({
  starter: z.boolean().optional(),
  jersey: z.string().optional(),
  formationPlace: z.string().optional(),
  position: z.object({ abbreviation: z.string().optional() }).optional(),
  athlete: z
    .object({ displayName: z.string().optional(), shortName: z.string().optional() })
    .optional(),
});

const rosterSchema = z.object({
  homeAway: z.enum(["home", "away"]).optional(),
  formation: z.string().optional(),
  team: z
    .object({ id: z.string().optional(), abbreviation: z.string().optional() })
    .optional(),
  roster: z.array(playerSchema).optional(),
});

const keyEventSchema = z.object({
  type: z.object({ type: z.string().optional(), text: z.string().optional() }).optional(),
  clock: z.object({ displayValue: z.string().optional() }).optional(),
  team: z.object({ id: z.string().optional() }).optional(),
  participants: z
    .array(z.object({ athlete: z.object({ displayName: z.string().optional() }).optional() }))
    .nullish(),
});

const summarySchema = z.object({
  rosters: z.array(rosterSchema).optional(),
  keyEvents: z.array(keyEventSchema).nullish(),
});

const POS_MAP: Record<string, string> = { G: "GK", D: "DF", M: "MF", F: "FW" };

function mapPos(abbr: string | undefined): string {
  if (!abbr) return "";
  return POS_MAP[abbr] ?? abbr.toUpperCase();
}

function toLineup(
  roster: z.infer<typeof rosterSchema>,
  side: Side,
): TeamLineup {
  const all = roster.roster ?? [];
  const starters = all.filter((p) => p.starter === true);
  const chosen = (starters.length ? starters : all.slice(0, 11)).slice();
  chosen.sort(
    (a, b) =>
      (Number.parseInt(a.formationPlace ?? "", 10) || 99) -
      (Number.parseInt(b.formationPlace ?? "", 10) || 99),
  );
  return {
    side,
    code: roster.team?.abbreviation ?? "",
    formation: roster.formation ?? "",
    players: chosen.map((p) => ({
      number: p.jersey ?? "",
      pos: mapPos(p.position?.abbreviation),
      name: p.athlete?.displayName ?? p.athlete?.shortName ?? "",
    })),
  };
}

/**
 * Substitutions come from the summary's chronological `keyEvents` feed. ESPN
 * lists the incoming player first and the replaced player second.
 */
function toSubs(
  events: z.infer<typeof keyEventSchema>[] | null | undefined,
  sideByTeamId: Map<string, Side>,
): MatchSub[] {
  if (!events) return [];
  return events
    .filter((e) => e.type?.type === "substitution" || e.type?.text === "Substitution")
    .map((e): MatchSub | null => {
      const id = e.team?.id;
      const side = id ? sideByTeamId.get(id) : undefined;
      if (!side) return null;
      return {
        side,
        clock: e.clock?.displayValue ?? "",
        playerIn: e.participants?.[0]?.athlete?.displayName ?? "",
        playerOut: e.participants?.[1]?.athlete?.displayName ?? "",
      };
    })
    .filter((s): s is MatchSub => s !== null);
}

/** Parse a summary payload into home/away lineups, or null when unavailable. */
export function parseLineups(raw: unknown): MatchLineups | null {
  const parsed = summarySchema.safeParse(raw);
  if (!parsed.success || !parsed.data.rosters || parsed.data.rosters.length < 2) {
    return null;
  }
  const rosters = parsed.data.rosters;
  const home = rosters.find((r) => r.homeAway === "home") ?? rosters[0];
  const away = rosters.find((r) => r.homeAway === "away") ?? rosters[1];
  const homeLineup = toLineup(home, "home");
  const awayLineup = toLineup(away, "away");
  // No starters on either side → treat as unavailable (e.g. not yet announced).
  if (!homeLineup.players.length && !awayLineup.players.length) return null;
  const sideByTeamId = new Map<string, Side>();
  if (home.team?.id) sideByTeamId.set(home.team.id, "home");
  if (away.team?.id) sideByTeamId.set(away.team.id, "away");
  return {
    home: homeLineup,
    away: awayLineup,
    subs: toSubs(parsed.data.keyEvents, sideByTeamId),
  };
}

export function summaryUrl(eventId: string, league: string): string {
  return `https://site.api.espn.com/apis/site/v2/sports/soccer/${encodeURIComponent(
    league,
  )}/summary?event=${encodeURIComponent(eventId)}`;
}

export interface FetchLineupsOptions {
  league?: string;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}

export async function fetchLineups(
  eventId: string,
  options: FetchLineupsOptions = {},
): Promise<MatchLineups | null> {
  const league = options.league ?? DEFAULT_LEAGUE;
  const doFetch = options.fetchImpl ?? fetch;
  const res = await doFetch(summaryUrl(eventId, league), {
    signal: options.signal,
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(
      `ESPN summary request failed: ${res.status} ${res.statusText}`,
    );
  }
  const json: unknown = await res.json();
  return parseLineups(json);
}
