export type { Match, MatchState, Team } from "@/lib/espn/types";
export {
  fetchScoreboard,
  scoreboardUrl,
  DEFAULT_LEAGUE,
  type FetchScoreboardOptions,
} from "@/lib/espn/client";
export { parseScoreboard } from "@/lib/espn/parse";
