// Watch-together — the VIEWER's deterministic replay.
//
// A viewer reconstructs the exact live world from a BroadcastState by re-running
// the SAME seeded sim the host ran. Crucially it threads cards/injuries the same
// way (suspensions/injuries repair later lineups), so a match that turns on a
// missing player stays bit-identical to the host — pure seed sync only holds if
// the status carryover is replayed too. Mock field only (fillTo48([]) is identical
// on both ends); a drafted roster would need broadcasting the squads.
import {
  advanceStatus,
  applyMatchEvents,
  bracketMatchSeed,
  buildBracket,
  fillTo48,
  finishRound,
  playRound,
  simulateMatchOnPitch,
  type Bracket,
} from "./tournament";
import {
  drawGroups,
  finishMatchday,
  groupMatchSeed,
  playMatchday,
  type GroupMatch,
  type GroupStage,
} from "./groups";
import { autoLineup, DEFAULT_FORMATION, repairLineup, type Lineup, type StatusMap } from "./squad";
import type { Team } from "./engine";
import type { BroadcastState } from "./watch-sync";

export interface ReplayWorld {
  phase: "groups" | "bracket";
  byId: Map<string, Team>;
  stage: GroupStage | null; // groups
  bracket: Bracket | null; // bracket
  /** The status-threaded, repaired lineups the replay USED for the current live stage's
   * matches, keyed by team id. The viewer's spotlight pitch MUST feed the SAME lineup
   * into its {scoring} sim — same seed + a different XI (e.g. a naive autoLineup that
   * ignores suspensions) makes the on-pitch scoreline diverge from the bracket/standings
   * rendered beside it (xG-unification INV-1 on the viewer). */
  lineups: Record<string, Lineup>;
}

/** Build the 48-team mock field once — deterministic, identical to the host's. */
export function replayField(): { teams: Team[]; byId: Map<string, Team> } {
  const teams = fillTo48([]);
  return { teams, byId: new Map(teams.map((t) => [t.id, t])) };
}

/** Replay the group stage to `stageIdx` (that matchday LIVE unless `done`), threading
 * lineups + status exactly like the host so scorelines match. */
export function replayGroups(byId: Map<string, Team>, ids: string[], seed: number, stageIdx: number, done: boolean, outLineups?: Record<string, Lineup>): GroupStage {
  let stage = drawGroups(ids, seed);
  let status: StatusMap = {};
  // populate the caller's map (if given) so the viewer can feed the SAME lineup into
  // its spotlight sim — after the live stage's ensure(), this holds the exact XI `sim` used.
  const lineups: Record<string, Lineup> = outLineups ?? {};
  const ensure = () => {
    for (const id of ids) {
      const t = byId.get(id);
      if (t) lineups[id] = repairLineup(t, lineups[id], status);
    }
  };
  const sim = (m: GroupMatch) => {
    const h = byId.get(m.homeId)!;
    const a = byId.get(m.awayId)!;
    return simulateMatchOnPitch(
      h, a,
      lineups[m.homeId] ?? autoLineup(h, DEFAULT_FORMATION, status),
      lineups[m.awayId] ?? autoLineup(a, DEFAULT_FORMATION, status),
      groupMatchSeed(seed, m.group, m.matchday, m.slot),
      { allowDraw: true },
    );
  };
  const finishedUpto = done ? 3 : stageIdx;
  for (let md = 0; md < finishedUpto; md++) {
    ensure();
    stage = finishMatchday(playMatchday(stage, md, sim), md);
    const ev = stage.groups.flatMap((g) => g.matchdays[md].flatMap((m) => m.result?.events ?? []));
    status = applyMatchEvents(advanceStatus(status), ev);
  }
  if (!done && stageIdx >= 0 && stageIdx < 3) {
    ensure();
    stage = playMatchday(stage, stageIdx, sim);
  }
  return stage;
}

/** Replay the knockout to `stageIdx` (that round LIVE unless `done`). */
export function replayBracket(byId: Map<string, Team>, ids: string[], seed: number, stageIdx: number, done: boolean, outLineups?: Record<string, Lineup>): Bracket {
  let bracket = buildBracket(ids, seed);
  let status: StatusMap = {};
  const lineups: Record<string, Lineup> = outLineups ?? {};
  const roundTeamIds = (b: Bracket, r: number) => b[r].flatMap((m) => [m.homeId, m.awayId]).filter((x): x is string => x != null);
  const ensure = (b: Bracket, r: number) => {
    for (const id of roundTeamIds(b, r)) {
      const t = byId.get(id);
      if (t) lineups[id] = repairLineup(t, lineups[id], status);
    }
  };
  const sim = (homeId: string, awayId: string, round: number, slot: number) => {
    const h = byId.get(homeId)!;
    const a = byId.get(awayId)!;
    return simulateMatchOnPitch(
      h, a,
      lineups[homeId] ?? autoLineup(h, DEFAULT_FORMATION, status),
      lineups[awayId] ?? autoLineup(a, DEFAULT_FORMATION, status),
      bracketMatchSeed(seed, round, slot),
    );
  };
  const finishedUpto = done ? bracket.length : stageIdx;
  for (let r = 0; r < finishedUpto; r++) {
    ensure(bracket, r);
    bracket = finishRound(playRound(bracket, r, sim), r);
    status = applyMatchEvents(advanceStatus(status), bracket[r].flatMap((m) => m.result?.events ?? []));
  }
  if (!done && stageIdx >= 0 && stageIdx < bracket.length) {
    ensure(bracket, stageIdx);
    bracket = playRound(bracket, stageIdx, sim);
  }
  return bracket;
}

/**
 * Reconstruct the whole world a viewer should render from a broadcast snapshot.
 *
 * `providedTeams` is the ORDERED field a drafted room broadcasts (the real rosters).
 * When absent, falls back to the deterministic mock 48 (fillTo48) — used by the fidelity
 * tests and any all-mock room. ORDER IS LOAD-BEARING for groups: drawGroups(ids, seed)
 * shuffles the input array order, so groups ids come from providedTeams.map(t=>t.id) in
 * the exact broadcast order (never a byId key order). The bracket takes its order from
 * state.teamIds (already order-preserving) and only looks teams up in byId.
 */
export function replayWorld(state: BroadcastState, providedTeams?: Team[]): ReplayWorld {
  const teams = providedTeams ?? replayField().teams;
  const byId = new Map(teams.map((t) => [t.id, t]));
  const lineups: Record<string, Lineup> = {};
  if (state.phase === "groups") {
    const ids = teams.map((t) => t.id);
    return { phase: "groups", byId, stage: replayGroups(byId, ids, state.seed, state.stageIdx, state.done, lineups), bracket: null, lineups };
  }
  // state.teamIds ⊆ providedTeams ids (same team objects across groups→bracket), so byId
  // resolves every teamId; order comes from teamIds, not the (possibly-48-superset) field.
  const ids = state.teamIds ?? teams.slice(0, 32).map((t) => t.id);
  return { phase: "bracket", byId, stage: null, bracket: replayBracket(byId, ids, state.seed, state.stageIdx, state.done, lineups), lineups };
}
