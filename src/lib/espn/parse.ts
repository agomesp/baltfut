import { z } from "zod";
import type { Match, MatchGoal, MatchState, Side, Team } from "@/lib/espn/types";

/**
 * Runtime validation for the slice of ESPN's scoreboard response we rely on.
 * ESPN is a third party we don't control, so every field is validated before it
 * reaches the app (secure-first: never trust external shape). Unknown extra keys
 * are ignored. A single malformed event is skipped, not fatal.
 */
const rawTeamSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  abbreviation: z.string(),
  logo: z.string().optional(),
});

const rawCompetitorSchema = z.object({
  homeAway: z.enum(["home", "away"]),
  score: z.string().optional(),
  team: rawTeamSchema,
});

const rawDetailSchema = z.object({
  scoringPlay: z.boolean().optional(),
  clock: z.object({ displayValue: z.string().optional() }).optional(),
  type: z.object({ text: z.string().optional() }).optional(),
  team: z.object({ id: z.string() }).optional(),
  athletesInvolved: z
    .array(z.object({ displayName: z.string().optional() }))
    .nullish(),
});

const rawCompetitionSchema = z.object({
  competitors: z.array(rawCompetitorSchema).min(1),
  venue: z
    .object({ address: z.object({ city: z.string().optional() }).optional() })
    .optional(),
  details: z.array(rawDetailSchema).optional(),
});

const rawEventSchema = z.object({
  id: z.string(),
  date: z.string().optional(),
  name: z.string().optional(),
  shortName: z.string().optional(),
  status: z.object({
    displayClock: z.string().optional(),
    type: z.object({
      state: z.enum(["pre", "in", "post"]),
      detail: z.string().optional(),
      shortDetail: z.string().optional(),
    }),
  }),
  competitions: z.array(rawCompetitionSchema).min(1),
});

const rawScoreboardSchema = z.object({ events: z.array(z.unknown()) });

type RawCompetitor = z.infer<typeof rawCompetitorSchema>;
type RawDetail = z.infer<typeof rawDetailSchema>;

function toTeam(c: RawCompetitor): Team {
  return {
    id: c.team.id,
    name: c.team.displayName,
    abbreviation: c.team.abbreviation,
    logo: c.team.logo ?? null,
  };
}

/** Before kickoff ESPN still reports "0"; treat that as "no score yet". */
function toScore(state: MatchState, score: string | undefined): number | null {
  if (state === "pre" || score == null) return null;
  const n = Number.parseInt(score, 10);
  return Number.isNaN(n) ? null : n;
}

function toGoals(
  details: RawDetail[] | undefined,
  sideByTeamId: Map<string, Side>,
): MatchGoal[] {
  if (!details) return [];
  // scoringPlay === true marks a goal (incl. penalties/own goals); cards are false.
  return details
    .filter((d) => d.scoringPlay === true)
    .map((d): MatchGoal | null => {
      const side = d.team ? sideByTeamId.get(d.team.id) : undefined;
      if (!side) return null;
      return {
        side,
        clock: d.clock?.displayValue ?? "",
        scorer: d.athletesInvolved?.[0]?.displayName ?? "",
        type: d.type?.text ?? "Goal",
      };
    })
    .filter((g): g is MatchGoal => g !== null);
}

function parseEvent(raw: unknown, league: string): Match | null {
  const parsed = rawEventSchema.safeParse(raw);
  if (!parsed.success) return null;

  const event = parsed.data;
  const competition = event.competitions[0];
  const homeRaw = competition.competitors.find((c) => c.homeAway === "home");
  const awayRaw = competition.competitors.find((c) => c.homeAway === "away");
  if (!homeRaw || !awayRaw) return null;

  const state = event.status.type.state;
  const isLive = state === "in";

  const sideByTeamId = new Map<string, Side>([
    [homeRaw.team.id, "home"],
    [awayRaw.team.id, "away"],
  ]);

  return {
    id: event.id,
    league,
    name: event.name ?? "",
    shortName: event.shortName ?? "",
    startsAt: event.date ?? "",
    state,
    isLive,
    statusDetail: event.status.type.shortDetail ?? event.status.type.detail ?? "",
    displayClock: isLive ? event.status.displayClock ?? null : null,
    venue: competition.venue?.address?.city ?? null,
    home: toTeam(homeRaw),
    away: toTeam(awayRaw),
    homeScore: toScore(state, homeRaw.score),
    awayScore: toScore(state, awayRaw.score),
    goals: toGoals(competition.details, sideByTeamId),
  };
}

/**
 * Normalize an ESPN scoreboard payload into our `Match[]`.
 * Returns `[]` for non-conforming input and silently skips malformed events so
 * one bad record never blanks the whole board.
 */
export function parseScoreboard(raw: unknown, league: string): Match[] {
  const root = rawScoreboardSchema.safeParse(raw);
  if (!root.success) return [];

  return root.data.events
    .map((event) => parseEvent(event, league))
    .filter((m): m is Match => m !== null);
}
