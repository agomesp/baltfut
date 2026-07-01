// The viewer's replay must be deterministic (so every viewer sees the same match)
// and structurally faithful to the host (finished stages count; the current stage
// is live). Host==viewer scoreline fidelity is proven live via two channels; here
// we pin determinism + shape.
import { describe, it, expect } from "vitest";
import { replayWorld, replayGroups, replayField } from "./watch-replay";
import { standings, qualified32 } from "./groups";
import { championId } from "./tournament";
import type { BroadcastState } from "./watch-sync";

const gState = (over: Partial<BroadcastState> = {}): BroadcastState => ({
  v: 1, phase: "groups", seed: 2026, stageIdx: 2, kickoffEpochMs: 0, baseMin: 0,
  speed: 1, playing: true, spotlight: null, done: true, teamIds: null, ...over,
});

describe("watch-replay", () => {
  it("is deterministic — two viewers reconstruct the identical world", () => {
    expect(replayWorld(gState())).toEqual(replayWorld(gState()));
  });

  it("a finished group stage yields exactly 32 unique qualifiers", () => {
    const w = replayWorld(gState());
    expect(w.stage).not.toBeNull();
    const q = qualified32(w.stage!);
    expect(q).toHaveLength(32);
    expect(new Set(q).size).toBe(32);
    for (const g of w.stage!.groups) for (const r of standings(g, w.stage!.seed)) expect(r.P).toBe(3);
  });

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
  });

  it("bracket phase: a full replay crowns a champion", () => {
    const teams = replayField().teams;
    const ids = teams.slice(0, 32).map((t) => t.id);
    const w = replayWorld(gState({ phase: "bracket", seed: 7, stageIdx: 4, done: true, teamIds: ids }));
    expect(w.bracket).not.toBeNull();
    expect(championId(w.bracket!)).not.toBeNull();
  });

  it("a different seed reconstructs a different group stage", () => {
    expect(replayWorld(gState({ seed: 1 }))).not.toEqual(replayWorld(gState({ seed: 2 })));
  });
});
