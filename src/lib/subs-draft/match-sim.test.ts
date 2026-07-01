import { describe, it, expect } from "vitest";
import { createMatchSim } from "./match-sim";
import { autoLineup, fieldLayout, type FieldSlot } from "./squad";
import { mockField } from "./tournament";
import type { Cat } from "./data";

const ROLES: Cat[] = ["Goleiro", "Defensor", "Defensor", "Defensor", "Defensor", "Meio-campo", "Meio-campo", "Meio-campo", "Meio-campo", "Atacante", "Atacante"];
const BAND: Record<Cat, number> = { Goleiro: 8, Defensor: 26, "Meio-campo": 48, Atacante: 66 };
function xi(rating: number, side: "home" | "away"): FieldSlot[] {
  return ROLES.map((role, i) => ({ id: `${side}${i}`, name: "p", role, x: 18 + (i % 5) * 16, y: side === "home" ? BAND[role] : 100 - BAND[role], rating }));
}
function shotCounts(homeSlots: FieldSlot[], awaySlots: FieldSlot[], sims: number): { home: number; away: number } {
  let home = 0;
  let away = 0;
  for (let k = 0; k < sims; k++) {
    const sim = createMatchSim(homeSlots, awaySlots);
    for (let i = 0; i < 3000; i++) sim.step(0.016);
    const s = sim.snapshot().shots;
    home += s.home;
    away += s.away;
  }
  return { home, away };
}

const field = mockField();
const home = fieldLayout(field[0], autoLineup(field[0], "4-4-2", {}), "home");
const away = fieldLayout(field[1], autoLineup(field[1], "4-3-3", {}), "away");

function run(steps: number) {
  const sim = createMatchSim(home, away);
  const ball: { x: number; y: number }[] = [];
  const trails: { x: number; y: number }[][] = home.map(() => []);
  for (let i = 0; i < steps; i++) {
    sim.step(0.016);
    const s = sim.snapshot();
    ball.push({ ...s.ball });
    s.home.forEach((p, j) => trails[j].push({ ...p }));
  }
  return { sim, ball, trails };
}

const range = (xs: number[]) => Math.max(...xs) - Math.min(...xs);

describe("match-sim produces real, flowing movement (not lined up)", () => {
  it("moves the ball around the whole pitch over time", () => {
    const { ball } = run(700); // ~11s at 60fps
    expect(range(ball.map((b) => b.y))).toBeGreaterThan(28); // travels end to end
    expect(range(ball.map((b) => b.x))).toBeGreaterThan(13); // and side to side
  });

  it("outfield players leave their formation anchors and roam", () => {
    const { trails } = run(700);
    const maxRoam = Math.max(...trails.slice(1).map((t) => range(t.map((p) => p.y)))); // skip GK (index 0)
    expect(maxRoam).toBeGreaterThan(12); // some outfielder covers real ground up/down
  });

  it("the ball changes possession/direction (not a straight drift)", () => {
    const { ball } = run(700);
    let reversals = 0;
    for (let i = 2; i < ball.length; i++) {
      const d1 = ball[i - 1].y - ball[i - 2].y;
      const d2 = ball[i].y - ball[i - 1].y;
      if (d1 * d2 < 0 && Math.abs(d2) > 0.05) reversals++;
    }
    expect(reversals).toBeGreaterThan(6); // play flows back and forth
  });

  it("the ball travels faster than the players (struck passes / shots)", () => {
    const { ball, trails } = run(700);
    const maxStep = (arr: { x: number; y: number }[]) =>
      Math.max(...arr.slice(1).map((p, i) => Math.hypot(p.x - arr[i].x, p.y - arr[i].y)));
    const ballMax = maxStep(ball);
    const playerMax = Math.max(...trails.map(maxStep));
    expect(ballMax).toBeGreaterThan(playerMax * 1.4);
  });

  it("scoreFor drives the ball to the attacked goal", () => {
    const sim = createMatchSim(home, away);
    for (let i = 0; i < 30; i++) sim.step(0.016);
    sim.scoreFor("home"); // home attacks y=100
    let maxY = 0;
    for (let i = 0; i < 60; i++) {
      sim.step(0.016);
      maxY = Math.max(maxY, sim.snapshot().ball.y);
    }
    expect(maxY).toBeGreaterThan(90);
  });

  it("a much stronger XI creates more chances (ratings wired into passing/tackling)", () => {
    const s = shotCounts(xi(93, "home"), xi(66, "away"), 3); // 93-rated home vs 66-rated away
    expect(s.home).toBeGreaterThan(s.away);
  });

  it("produces open-play shots, saves and restarts (on-pitch captions fire)", () => {
    const caps = new Set<string>();
    for (let k = 0; k < 3; k++) {
      const sim = createMatchSim(xi(82, "home"), xi(82, "away"));
      for (let i = 0; i < 3500; i++) {
        sim.step(0.016);
        const c = sim.snapshot().caption;
        if (c) caps.add(c);
      }
    }
    expect(caps.size).toBeGreaterThan(0);
    expect([...caps].some((c) => /Chute|Defesa|Rebote|fora|Lateral|meta|Escanteio|Cruzamento|Lançamento|Falta|Cabeça|Bloqueio|Cartão|área/.test(c))).toBe(true);
  });

  it("books players on fouls and streams match events", () => {
    let bookings = 0;
    let events = 0;
    for (let k = 0; k < 4; k++) {
      const sim = createMatchSim(xi(80, "home"), xi(80, "away"));
      for (let i = 0; i < 3000; i++) sim.step(0.016);
      const s = sim.snapshot();
      bookings += Object.keys(s.bookings).length;
      events += s.eventSeq;
    }
    expect(bookings).toBeGreaterThan(0); // some yellow/red across the matches
    expect(events).toBeGreaterThan(0); // the events feed fired
  });

  it("sends off red-carded players (down to ≥8, never crashes)", () => {
    let totalSentOff = 0;
    let minPerSide = 11;
    for (let k = 0; k < 40; k++) {
      const sim = createMatchSim(xi(80, "home"), xi(80, "away"));
      for (let i = 0; i < 2500; i++) sim.step(0.016);
      const s = sim.snapshot();
      totalSentOff += s.sentOff.length;
      const offHome = s.sentOff.filter((id) => id.startsWith("home")).length;
      const offAway = s.sentOff.filter((id) => id.startsWith("away")).length;
      minPerSide = Math.min(minPerSide, 11 - offHome, 11 - offAway);
    }
    expect(totalSentOff).toBeGreaterThan(0); // some reds across 40 matches
    expect(minPerSide).toBeGreaterThanOrEqual(8); // never below 8 on the pitch
  });

  it("calls offside on forward passes beyond the last defender", () => {
    // A0.1 seeds make this deterministic — each of these seeds reliably produces an
    // offside within 3000 steps (probed), so the assertion never flakes on RNG.
    const SEEDS = [0, 2, 3, 6];
    let offsides = 0;
    for (const seed of SEEDS) {
      const sim = createMatchSim(xi(82, "home"), xi(82, "away"), seed);
      for (let i = 0; i < 3000; i++) { sim.step(0.016); if (sim.snapshot().caption === "Impedimento!") offsides++; }
    }
    expect(offsides).toBeGreaterThan(0);
  });

  it("keeps the goalkeeper near its own goal (no wandering into midfield)", () => {
    const sim = createMatchSim(xi(80, "home"), xi(80, "away"));
    let maxGkY = 0;
    for (let i = 0; i < 900; i++) {
      sim.step(0.016);
      maxGkY = Math.max(maxGkY, sim.snapshot().home[0].y); // home[0] = GK, defends y=0
    }
    expect(maxGkY).toBeLessThan(38);
  });

  it("places scripted goals wide of the keeper (into a corner)", () => {
    const sim = createMatchSim(xi(80, "home"), xi(80, "away"));
    for (let i = 0; i < 30; i++) sim.step(0.016);
    sim.scoreFor("home");
    let atLine = 50;
    for (let i = 0; i < 60; i++) {
      sim.step(0.016);
      const b = sim.snapshot().ball;
      if (b.y > 90 && b.y < 97) atLine = b.x;
    }
    expect(Math.abs(atLine - 50)).toBeGreaterThan(5); // not straight down the middle at the keeper
  });

  it("players tire over the match (fatigue slows them late)", () => {
    const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
    const covered = (progress: number) => {
      const sim = createMatchSim(xi(80, "home"), xi(80, "away"));
      for (let i = 0; i < 120; i++) sim.step(0.016, 0); // settle
      let d = 0;
      let prev = sim.snapshot().home;
      for (let i = 0; i < 400; i++) {
        sim.step(0.016, progress);
        const cur = sim.snapshot().home;
        d += cur.reduce((s, p, j) => s + dist(p, prev[j]), 0);
        prev = cur;
      }
      return d;
    };
    const avg = (progress: number) => { let t = 0; for (let k = 0; k < 5; k++) t += covered(progress); return t / 5; };
    expect(avg(1)).toBeLessThan(avg(0) * 0.92); // tired legs cover clearly less ground than fresh
  });

  it("commits fouls (free kicks) when challenges are mistimed", () => {
    let fouls = 0;
    for (let k = 0; k < 3; k++) {
      const sim = createMatchSim(xi(80, "home"), xi(80, "away"));
      for (let i = 0; i < 3000; i++) { sim.step(0.016); if (sim.snapshot().caption === "Falta!") fouls++; }
    }
    expect(fouls).toBeGreaterThan(0);
  });

  it("exposes possession share and shot tallies", () => {
    const sim = createMatchSim(xi(80, "home"), xi(80, "away"));
    for (let i = 0; i < 1500; i++) sim.step(0.016);
    const s = sim.snapshot();
    expect(s.possHome).toBeGreaterThanOrEqual(0);
    expect(s.possHome).toBeLessThanOrEqual(1);
    expect(s.shots.home + s.shots.away).toBeGreaterThanOrEqual(0);
  });

  it("keeps everyone on the pitch", () => {
    const { sim } = run(300);
    const s = sim.snapshot();
    for (const p of [...s.home, ...s.away, s.ball]) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(100);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(100);
    }
  });
});
