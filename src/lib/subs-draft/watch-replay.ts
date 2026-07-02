// Watch-together — the VIEWER's deterministic replay.
//
// A viewer reconstructs the exact live world from a BroadcastState by re-running
// the SAME seeded sim the host ran. Crucially it threads cards/injuries the same
// way (suspensions/injuries repair later lineups), so a match that turns on a
// missing player stays bit-identical to the host — pure seed sync only holds if
// the status carryover is replayed too. Teams come from the broadcast field (real
// drafted rosters) or fillTo48([]) for an all-mock room.
//
// The replay is ASYNC + time-sliced (computeChunked): re-running up to ~72 full
// 3600-step sims would freeze the main thread ~1.6s, so each stage's matches are
// computed in yielded chunks. Determinism is untouched — status still threads
// sequentially BETWEEN stages; only the (independent) matches WITHIN a stage are
// sliced, and results come back in order.
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
import { computeChunked } from "./async-sim";
import type { Team } from "./engine";
import type { BroadcastState } from "./watch-sync";

/** Yield after each ~22ms match while replaying so the viewer stays responsive. */
const SIM_BATCH = 1;

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
export async function replayGroups(byId: Map<string, Team>, ids: string[], seed: number, stageIdx: number, done: boolean, outLineups?: Record<string, Lineup>, signal?: AbortSignal): Promise<GroupStage> {
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
  // time-sliced: compute a matchday's pending fixtures in yielded chunks, then feed the
  // results into the pure playMatchday via a lookup (status is frozen for the whole
  // matchday, so slicing the independent matches is bit-identical to the sync version).
  const playMd = async (md: number) => {
    const matches = stage.groups.flatMap((g) => g.matchdays[md] ?? []).filter((m) => m.status === "pending");
    const results = await computeChunked(matches, sim, { signal, batch: SIM_BATCH });
    const by = new Map(matches.map((m, i) => [m.id, results[i]]));
    return playMatchday(stage, md, (m) => by.get(m.id)!);
  };
  const finishedUpto = done ? 3 : stageIdx;
  for (let md = 0; md < finishedUpto; md++) {
    ensure();
    stage = finishMatchday(await playMd(md), md);
    const ev = stage.groups.flatMap((g) => g.matchdays[md].flatMap((m) => m.result?.events ?? []));
    status = applyMatchEvents(advanceStatus(status), ev);
  }
  if (!done && stageIdx >= 0 && stageIdx < 3) {
    ensure();
    stage = await playMd(stageIdx);
  }
  return stage;
}

/** Replay the knockout to `stageIdx` (that round LIVE unless `done`). */
export async function replayBracket(byId: Map<string, Team>, ids: string[], seed: number, stageIdx: number, done: boolean, outLineups?: Record<string, Lineup>, signal?: AbortSignal): Promise<Bracket> {
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
  // time-sliced: precompute a round's live matches (both teams, no result — exactly what
  // playRound sims) in yielded chunks, keyed by slot, then feed them into pure playRound.
  const playR = async (r: number) => {
    const live = bracket[r].filter((m) => m.homeId && m.awayId && !m.result);
    const results = await computeChunked(live, (m) => sim(m.homeId!, m.awayId!, r, m.slot), { signal, batch: SIM_BATCH });
    const by = new Map(live.map((m, i) => [m.slot, results[i]]));
    return playRound(bracket, r, (_h, _a, _round, slot) => by.get(slot)!);
  };
  const finishedUpto = done ? bracket.length : stageIdx;
  for (let r = 0; r < finishedUpto; r++) {
    ensure(bracket, r);
    bracket = finishRound(await playR(r), r);
    status = applyMatchEvents(advanceStatus(status), bracket[r].flatMap((m) => m.result?.events ?? []));
  }
  if (!done && stageIdx >= 0 && stageIdx < bracket.length) {
    ensure(bracket, stageIdx);
    bracket = await playR(stageIdx);
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
export async function replayWorld(state: BroadcastState, providedTeams?: Team[], signal?: AbortSignal): Promise<ReplayWorld> {
  const teams = providedTeams ?? replayField().teams;
  const byId = new Map(teams.map((t) => [t.id, t]));
  const lineups: Record<string, Lineup> = {};
  if (state.phase === "groups") {
    const ids = teams.map((t) => t.id);
    const stage = await replayGroups(byId, ids, state.seed, state.stageIdx, state.done, lineups, signal);
    return { phase: "groups", byId, stage, bracket: null, lineups };
  }
  // state.teamIds ⊆ providedTeams ids (same team objects across groups→bracket), so byId
  // resolves every teamId; order comes from teamIds, not the (possibly-48-superset) field.
  const ids = state.teamIds ?? teams.slice(0, 32).map((t) => t.id);
  const bracket = await replayBracket(byId, ids, state.seed, state.stageIdx, state.done, lineups, signal);
  return { phase: "bracket", byId, stage: null, bracket, lineups };
}
