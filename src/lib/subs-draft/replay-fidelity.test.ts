// ADVERSARIAL: does the viewer's replay reconstruct the HOST's EXACT match?
// We replicate the host component's imperative loops (groups-view / tournament-view)
// as plain functions here, then compare their output to the viewer's replay* fns.
import { describe, it, expect } from "vitest";
import {
  buildBracket,
  bracketMatchSeed,
  playRound,
  finishRound,
  advanceStatus,
  applyMatchEvents,
  championId,
  simulateMatch,
  type Bracket,
  type MatchResult,
} from "./tournament";
import {
  drawGroups,
  playMatchday,
  finishMatchday,
  groupMatchSeed,
  qualified32,
  standings,
  type GroupStage,
  type GroupMatch,
} from "./groups";
import {
  autoLineup,
  DEFAULT_FORMATION,
  repairLineup,
  startingPlayers,
  type Lineup,
  type StatusMap,
} from "./squad";
import type { Team } from "./engine";
import { replayGroups, replayBracket, replayField } from "./watch-replay";

/* ── HOST replicas (copied faithfully from the component loops) ─────────────── */

// groups-view.tsx: startMatchday(ensureLineups→playMatchday) + finalizeMatchday
// played live at 1×, one matchday at a time, then finished. Returns the stage at
// the point matchday `liveIdx` is LIVE (played, not finished), plus status/lineups.
function hostGroupsLive(byId: Map<string, Team>, ids: string[], seed: number, liveIdx: number) {
  let stage: GroupStage = drawGroups(ids, seed);
  let status: StatusMap = {};
  const lineupsRef: Record<string, Lineup> = {};
  const ensureLineups = () => {
    const next = { ...lineupsRef };
    for (const id of ids) {
      const t = byId.get(id);
      if (t) next[id] = repairLineup(t, next[id], status);
    }
    Object.assign(lineupsRef, next);
  };
  const simById = (homeId: string, awayId: string, s: number): MatchResult => {
    const home = byId.get(homeId)!;
    const away = byId.get(awayId)!;
    const hl = lineupsRef[homeId] ?? autoLineup(home, DEFAULT_FORMATION, status);
    const al = lineupsRef[awayId] ?? autoLineup(away, DEFAULT_FORMATION, status);
    return simulateMatch(home, away, startingPlayers(home, hl), startingPlayers(away, al), s, { allowDraw: true });
  };
  const simMatch = (m: GroupMatch) => simById(m.homeId, m.awayId, groupMatchSeed(stage.seed, m.group, m.matchday, m.slot));

  for (let md = 0; md < 3; md++) {
    // startMatchday
    ensureLineups();
    stage = playMatchday(stage, md, simMatch);
    if (md === liveIdx) return { stage, status, lineupsRef };
    // finalizeMatchday
    stage = finishMatchday(stage, md);
    const events = stage.groups.flatMap((g) => g.matchdays[md].flatMap((m) => m.result?.events ?? []));
    status = applyMatchEvents(advanceStatus(status), events);
  }
  return { stage, status, lineupsRef };
}

// groups-view.tsx: finalizeMatchday for the last matchday (md=2) → done stage
function hostGroupsDone(byId: Map<string, Team>, ids: string[], seed: number): GroupStage {
  let stage: GroupStage = drawGroups(ids, seed);
  let status: StatusMap = {};
  const lineupsRef: Record<string, Lineup> = {};
  const ensureLineups = () => {
    const next = { ...lineupsRef };
    for (const id of ids) {
      const t = byId.get(id);
      if (t) next[id] = repairLineup(t, next[id], status);
    }
    Object.assign(lineupsRef, next);
  };
  const simMatch = (m: GroupMatch) => {
    const home = byId.get(m.homeId)!;
    const away = byId.get(m.awayId)!;
    const hl = lineupsRef[m.homeId] ?? autoLineup(home, DEFAULT_FORMATION, status);
    const al = lineupsRef[m.awayId] ?? autoLineup(away, DEFAULT_FORMATION, status);
    return simulateMatch(home, away, startingPlayers(home, hl), startingPlayers(away, al), groupMatchSeed(stage.seed, m.group, m.matchday, m.slot), { allowDraw: true });
  };
  for (let md = 0; md < 3; md++) {
    ensureLineups();
    stage = finishMatchday(playMatchday(stage, md, simMatch), md);
    const events = stage.groups.flatMap((g) => g.matchdays[md].flatMap((m) => m.result?.events ?? []));
    status = applyMatchEvents(advanceStatus(status), events);
  }
  return stage;
}

// tournament-view.tsx: startRound + finalize round by round → live at round `liveIdx`.
function hostBracketLive(byId: Map<string, Team>, ids: string[], seed: number, liveIdx: number) {
  let bracket: Bracket = buildBracket(ids, seed);
  let status: StatusMap = {};
  const lineupsRef: Record<string, Lineup> = {};
  const roundTeamIds = (b: Bracket, idx: number) => b[idx].flatMap((m) => [m.homeId, m.awayId]).filter((x): x is string => x != null);
  const ensureLineups = (teamIds: string[]) => {
    const next = { ...lineupsRef };
    for (const id of teamIds) {
      const t = byId.get(id);
      if (t) next[id] = repairLineup(t, next[id], status);
    }
    Object.assign(lineupsRef, next);
  };
  const simById = (homeId: string, awayId: string, round: number, slot: number): MatchResult => {
    const home = byId.get(homeId)!;
    const away = byId.get(awayId)!;
    const hl = lineupsRef[homeId] ?? autoLineup(home, DEFAULT_FORMATION, status);
    const al = lineupsRef[awayId] ?? autoLineup(away, DEFAULT_FORMATION, status);
    return simulateMatch(home, away, startingPlayers(home, hl), startingPlayers(away, al), bracketMatchSeed(seed, round, slot));
  };
  for (let r = 0; r < bracket.length; r++) {
    ensureLineups(roundTeamIds(bracket, r));
    bracket = playRound(bracket, r, simById);
    if (r === liveIdx) return { bracket, status };
    bracket = finishRound(bracket, r);
    status = applyMatchEvents(advanceStatus(status), bracket[r].flatMap((m) => m.result?.events ?? []));
  }
  return { bracket, status };
}

/* ── comparison helpers ─────────────────────────────────────────────────────── */

const scorelines = (stage: GroupStage) =>
  stage.groups.flatMap((g) =>
    g.matchdays.flatMap((md) => md.map((m) => `${m.id}:${m.status}:${m.result ? `${m.result.homeGoals}-${m.result.awayGoals}` : "?"}`)),
  );

const bracketScorelines = (b: Bracket) =>
  b.flatMap((round) => round.map((m) => `${m.id}:${m.status}:${m.homeId ?? "-"}v${m.awayId ?? "-"}:${m.result ? `${m.result.homeGoals}-${m.result.awayGoals}:${m.result.winnerId}` : "?"}`));

describe("replay fidelity: viewer == host, EXACTLY", () => {
  const { teams, byId } = replayField();
  const ids = teams.map((t) => t.id);

  it("groups: every matchday LIVE state is byte-identical to the host", () => {
    for (const liveIdx of [0, 1, 2]) {
      const host = hostGroupsLive(byId, ids, 2026, liveIdx);
      const viewer = replayGroups(byId, ids, 2026, liveIdx, false);
      expect(scorelines(viewer)).toEqual(scorelines(host.stage));
    }
  });

  it("groups: the DONE stage is byte-identical + same qualified32", () => {
    const host = hostGroupsDone(byId, ids, 2026);
    const viewer = replayGroups(byId, ids, 2026, 2, true);
    expect(scorelines(viewer)).toEqual(scorelines(host));
    expect(qualified32(viewer)).toEqual(qualified32(host));
    for (const g of viewer.groups) {
      expect(standings(g, viewer.seed)).toEqual(standings(host.groups.find((x) => x.name === g.name)!, host.seed));
    }
  });

  it("bracket: every round LIVE state is byte-identical to the host (real q32 field)", () => {
    // The REAL field the host feeds the bracket: fillTo48 order filtered to q32
    // (page.tsx onAdvance: state.field.filter(t => q32.includes(t.id))).
    const doneGroups = hostGroupsDone(byId, ids, 2026);
    const q32 = qualified32(doneGroups);
    const bracketField = ids.filter((id) => q32.includes(id)); // fillTo48 order, filtered
    for (const liveIdx of [0, 1, 2, 3, 4]) {
      const host = hostBracketLive(byId, bracketField, 2026, liveIdx);
      const viewer = replayBracket(byId, bracketField, 2026, liveIdx, false);
      expect(bracketScorelines(viewer)).toEqual(bracketScorelines(host.bracket));
    }
  });

  it("bracket: full replay crowns the SAME champion as the host", () => {
    const doneGroups = hostGroupsDone(byId, ids, 2026);
    const q32 = qualified32(doneGroups);
    const bracketField = ids.filter((id) => q32.includes(id));
    const host = hostBracketLive(byId, bracketField, 2026, 4); // final live
    const hostDone = finishRound(host.bracket, 4);
    const viewer = replayBracket(byId, bracketField, 2026, 4, true);
    expect(championId(viewer)).toBe(championId(hostDone));
  });

  it("REFUTATION PROBE: does status carryover actually change scorelines? "
    + "(if replay ignored status, would it still match?)", () => {
    // Sanity: a replay that does NOT thread status should DIFFER from the host on
    // some seed, proving the carryover threading is load-bearing (not a no-op).
    const naiveGroups = (seed: number): GroupStage => {
      let stage = drawGroups(ids, seed);
      const sim = (m: GroupMatch) => {
        const h = byId.get(m.homeId)!;
        const a = byId.get(m.awayId)!;
        // NO status, NO lineup threading — always the fresh auto XI
        return simulateMatch(h, a, startingPlayers(h, autoLineup(h, DEFAULT_FORMATION, {})), startingPlayers(a, autoLineup(a, DEFAULT_FORMATION, {})), groupMatchSeed(seed, m.group, m.matchday, m.slot), { allowDraw: true });
      };
      for (let md = 0; md < 3; md++) stage = finishMatchday(playMatchday(stage, md, sim), md);
      return stage;
    };
    let anyDiff = false;
    for (const seed of [1, 2, 2026, 99999, 7]) {
      const host = hostGroupsDone(byId, ids, seed);
      if (JSON.stringify(scorelines(naiveGroups(seed))) !== JSON.stringify(scorelines(host))) anyDiff = true;
    }
    // Threading is load-bearing: a seed-only replay that ignores status DOES
    // diverge from the host, so the viewer MUST re-thread it (and does — above).
    expect(anyDiff).toBe(true);
  });
});
