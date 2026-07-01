// The viewer's replay must be deterministic (so every viewer sees the same match)
// and structurally faithful to the host (finished stages count; the current stage
// is live). Host==viewer scoreline fidelity is proven live via two channels; here
// we pin determinism + shape.
import { describe, it, expect } from "vitest";
import { replayWorld, replayGroups, replayField } from "./watch-replay";
import { standings, qualified32 } from "./groups";
import { championId, simulateMatchOnPitch, bracketMatchSeed } from "./tournament";
import { autoLineup, DEFAULT_FORMATION } from "./squad";
import type { BroadcastState } from "./watch-sync";

const gState = (over: Partial<BroadcastState> = {}): BroadcastState => ({
  v: 1, phase: "groups", seed: 2026, stageIdx: 2, kickoffEpochMs: 0, baseMin: 0,
  speed: 1, playing: true, spotlight: null, done: true, teamIds: null, ...over,
});

// Each replay now runs a full headless pitch sim per match (~23ms), so a done-stage
// replay costs ~1.6s. These integration tests get an honest timeout.
const SLOW = 30_000;

describe("watch-replay", () => {
  it("is deterministic — two viewers reconstruct the identical world", () => {
    expect(replayWorld(gState())).toEqual(replayWorld(gState()));
  }, SLOW);

  it("a finished group stage yields exactly 32 unique qualifiers", () => {
    const w = replayWorld(gState());
    expect(w.stage).not.toBeNull();
    const q = qualified32(w.stage!);
    expect(q).toHaveLength(32);
    expect(new Set(q).size).toBe(32);
    for (const g of w.stage!.groups) for (const r of standings(g, w.stage!.seed)) expect(r.P).toBe(3);
  }, SLOW);

  it("mid-tournament: finished matchdays counted, current matchday LIVE", () => {
    const { byId, teams } = { ...replayField(), teams: replayField().teams };
    const ids = teams.map((t) => t.id);
    const stage = replayGroups(byId, ids, 2026, 1, false); // matchday 1 is live
    for (const g of stage.groups) {
      expect(g.matchdays[0].every((m) => m.status === "done")).toBe(true); // md0 finished
      expect(g.matchdays[1].every((m) => m.status === "live" && m.result)).toBe(true); // md1 live
      expect(g.matchdays[2].every((m) => m.status === "pending")).toBe(true); // md2 not started
      for (const r of standings(g, stage.seed)) expect(r.P).toBe(1); // only md0 counts
    }
  }, SLOW);

  it("bracket phase: a full replay crowns a champion", () => {
    const teams = replayField().teams;
    const ids = teams.slice(0, 32).map((t) => t.id);
    const w = replayWorld(gState({ phase: "bracket", seed: 7, stageIdx: 4, done: true, teamIds: ids }));
    expect(w.bracket).not.toBeNull();
    expect(championId(w.bracket!)).not.toBeNull();
  }, SLOW);

  it("a different seed reconstructs a different group stage", () => {
    expect(replayWorld(gState({ seed: 1 }))).not.toEqual(replayWorld(gState({ seed: 2 })));
  }, SLOW);

  // xG-unification INV-1 on the VIEWER: the spotlight pitch must run the SAME lineup the
  // headless scoreline used, or (same seed, different XI) its on-pitch score diverges from
  // the bracket it renders. replayWorld exposes those exact lineups; the viewer feeds them in.
  it("exposes the exact lineups the replay used → viewer's spotlight sim reproduces the bracket (INV-1)", () => {
    const ids = replayField().teams.slice(0, 32).map((t) => t.id);
    let checked = 0;
    let naiveDiffered = 0;
    for (const seed of [7, 2026, 3]) {
      const stageIdx = 1; // a live round late enough that suspensions have altered some XIs
      const w = replayWorld(gState({ phase: "bracket", seed, stageIdx, done: false, teamIds: ids }));
      for (const m of w.bracket![stageIdx]) {
        if (!m.homeId || !m.awayId || !m.result) continue;
        const home = w.byId.get(m.homeId)!;
        const away = w.byId.get(m.awayId)!;
        const s = bracketMatchSeed(seed, stageIdx, m.slot);
        // the exposed lineup reproduces the bracket's scoreline EXACTLY (what the pitch shows)
        const rep = simulateMatchOnPitch(home, away, w.lineups[m.homeId]!, w.lineups[m.awayId]!, s);
        expect(rep.homeGoals).toBe(m.result.homeGoals);
        expect(rep.awayGoals).toBe(m.result.awayGoals);
        // the naive default XI (the old viewer bug) does NOT reliably match — the fix matters
        const naive = simulateMatchOnPitch(home, away, autoLineup(home, DEFAULT_FORMATION, {}), autoLineup(away, DEFAULT_FORMATION, {}), s);
        if (naive.homeGoals !== m.result.homeGoals || naive.awayGoals !== m.result.awayGoals) naiveDiffered++;
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
    expect(naiveDiffered).toBeGreaterThan(0); // load-bearing: the wrong lineup DID diverge
  }, SLOW);

  // Drafted-roster broadcast: the viewer rebuilds the world from the PROVIDED field (the
  // real rosters), not the mock 48 — so people watch THEIR drafted teams.
  it("rebuilds the world from the broadcast drafted field, not the mock fallback", () => {
    const drafted = replayField().teams.map((t, i) => ({ ...t, id: `d${i}`, owner: `Sub ${i}` }));
    const w = replayWorld(gState(), drafted);
    expect([...w.byId.keys()]).toEqual(drafted.map((t) => t.id)); // the provided teams flow through, in order
    expect(w.byId.get("d0")!.owner).toBe("Sub 0");
    expect([...replayWorld(gState()).byId.keys()]).not.toEqual([...w.byId.keys()]); // ≠ the mock fallback
  }, SLOW);

  // The group draw is a pure function of the INPUT ARRAY ORDER (drawGroups shuffles it),
  // so the wire MUST preserve team order — this pins that invariant.
  it("group membership is order-sensitive: the same teams in a different order draw differently", () => {
    const field = replayField().teams;
    const g0 = (s: NonNullable<ReturnType<typeof replayWorld>["stage"]>) => standings(s.groups[0], s.seed).map((r) => r.teamId).sort();
    const a = replayWorld(gState(), field).stage!;
    const b = replayWorld(gState(), [...field].reverse()).stage!;
    expect(g0(a)).not.toEqual(g0(b));
  }, SLOW);
});
