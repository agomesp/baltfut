import { describe, it, expect } from "vitest";
import { advanceStatus, applyMatchEvents, mockField, type MatchEvent } from "./tournament";
import { autoLineup, available, repairLineup, startingPlayers, type StatusMap } from "./squad";

const team = mockField()[0]; // one 18-player mock squad
const ev = (playerId: string, type: MatchEvent["type"], out?: number | "cup"): MatchEvent => ({
  minute: 40, teamId: team.id, type, player: "x", playerId, out,
});

describe("cards & injuries carry across knockout rounds", () => {
  it("a red card suspends the player next round, then clears", () => {
    const p = team.roster.Defensor[0];
    let s: StatusMap = applyMatchEvents({}, [ev(p.id, "red")]);
    expect(available(s, p.id)).toBe(false);
    s = advanceStatus(s);
    expect(available(s, p.id)).toBe(true);
  });

  it("two yellows trigger a one-match ban", () => {
    const p = team.roster["Meio-campo"][0];
    const s = applyMatchEvents({}, [ev(p.id, "yellow"), ev(p.id, "yellow")]);
    expect(available(s, p.id)).toBe(false);
  });

  it("a single yellow is fine", () => {
    const p = team.roster["Meio-campo"][1];
    expect(available(applyMatchEvents({}, [ev(p.id, "yellow")]), p.id)).toBe(true);
  });

  it("an injury keeps a player out for N rounds, then fit", () => {
    const p = team.roster.Atacante[0];
    let s = applyMatchEvents({}, [ev(p.id, "injury", 2)]);
    expect(available(s, p.id)).toBe(false);
    s = advanceStatus(s);
    expect(available(s, p.id)).toBe(false); // one round left
    s = advanceStatus(s);
    expect(available(s, p.id)).toBe(true);
  });

  it("a season-ending injury never recovers", () => {
    const p = team.roster.Atacante[1];
    let s = applyMatchEvents({}, [ev(p.id, "injury", "cup")]);
    for (let i = 0; i < 6; i++) s = advanceStatus(s);
    expect(available(s, p.id)).toBe(false);
  });

  it("autoLineup excludes an unavailable player but still fields 11", () => {
    const p = team.roster.Atacante[0];
    const s = applyMatchEvents({}, [ev(p.id, "injury", 2)]);
    const xi = startingPlayers(team, autoLineup(team, "4-4-2", s));
    expect(xi.some((x) => x.id === p.id)).toBe(false);
    expect(xi.length).toBe(11);
  });

  it("repairLineup drops a starter who just got hurt and refills to 11", () => {
    const clean = autoLineup(team, "4-3-3", {});
    const starter = startingPlayers(team, clean).find((p) => p.cat === "Atacante")!;
    const s = applyMatchEvents({}, [ev(starter.id, "injury", 1)]);
    const xi = startingPlayers(team, repairLineup(team, clean, s));
    expect(xi.some((p) => p.id === starter.id)).toBe(false);
    expect(xi.length).toBe(11);
  });
});
