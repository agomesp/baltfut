// A lightweight rule-based 2D match simulation for the spotlight pitch. It is
// COSMETIC — the scoreline comes from tournament.ts; this only makes the on-screen
// play look like a real game.
//
// Model (frame-rate independent, dt seconds; progress 0..1 is match time elapsed):
//  · Players carry velocity + steer with limited acceleration (momentum); sprint
//    when chasing/carrying, jog off the ball, slow into their target, and TIRE late.
//  · The ball is physical: velocity + rolling friction. Passes get power by distance
//    and lead the receiver; shots are struck fast; loose balls roll and are chased.
//  · Ratings drive pace, pass accuracy, tackling and loose-ball recovery.
//  · Football: possession FSM; the block slides with the ball; defenders press + hold
//    a flat back line; KEEPERS stay home (they only contest near their own goal),
//    narrow the angle and save/parry shots; SHOTS are blocked by bodies in the path;
//    through-balls, crosses, headers, corners (to near/far post + a wall on free
//    kicks), throw-ins, goal kicks; FOULS give free kicks and can book a player;
//    scripted goals are placed into a corner past the beaten keeper. Possession %,
//    shots, bookings and an events feed are exposed.
//
// Coords: x = width 0..100, y = length 0..100. Home attacks toward y=100, away y=0.

import { mulberry32, randInt32 } from "./prng";
import type { Cat } from "./data";
import type { FieldSlot } from "./squad";

export type Side = "home" | "away";
export type Card = "yellow" | "red";
export interface Snapshot {
  home: { x: number; y: number }[];
  away: { x: number; y: number }[];
  ball: { x: number; y: number };
  poss: Side;
  controlled: boolean;
  caption: string | null;
  shots: { home: number; away: number };
  possHome: number;
  bookings: Record<string, Card>;
  sentOff: string[];
  eventSeq: number;
  eventText: string;
}
export interface MatchSim {
  step(dt: number, progress?: number): void;
  snapshot(): Snapshot;
  scoreFor(side: Side): void;
}

interface P {
  id: string;
  side: Side;
  role: Cat;
  rating: number;
  ax: number; ay: number;
  x: number; y: number;
  vx: number; vy: number;
  tx: number; ty: number;
  rt: number;
  pace: number;
}

const ATTACK = { home: { x: 50, y: 100 }, away: { x: 50, y: 0 } };
const OWN = { home: { x: 50, y: 0 }, away: { x: 50, y: 100 } };

const JOG = 12;
const SPRINT = 20;
const ACCEL = 46;
const BALL_FRICTION = 1.35;
const SHOT_FRICTION = 0.3;
const CONTROL = 2.7;
const DRIBBLE_LEAD = 2.0;
const TACKLE_RATE = 3.0;
const BLOCK_R = 2.3;

const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.min(1, t);

// A0 keystone: the whole sim draws from ONE seeded stream (see prng.ts), so the
// same seed replays the exact same match. `seed` defaults to entropy → the UI and
// variety-seeking tests behave randomly as before; pass a seed for a fixed replay.
export function createMatchSim(homeSlots: FieldSlot[], awaySlots: FieldSlot[], seed: number = randInt32()): MatchSim {
  const R = mulberry32(seed);
  const rnd = (a: number, b: number) => a + R() * (b - a);
  const mk = (s: FieldSlot, side: Side): P => ({
    id: s.id, side, role: s.role, rating: s.rating ?? 78, ax: s.x, ay: s.y, x: s.x, y: s.y, vx: 0, vy: 0, tx: s.x, ty: s.y, rt: 0,
    pace: 0.85 + ((s.rating ?? 78) - 70) / 60,
  });
  const home = homeSlots.map((s) => mk(s, "home"));
  const away = awaySlots.map((s) => mk(s, "away"));
  const all = [...home, ...away];
  const ball = { x: 50, y: 50, vx: 0, vy: 0 };
  const shots = { home: 0, away: 0 };
  const possFrames = { home: 0, away: 0 };
  const bookings: Record<string, Card> = {};
  const sentOff = new Set<string>();

  let poss: Side = R() < 0.5 ? "home" : "away";
  let offsidePending = false;
  let offsideT = 0;
  let carrier: P | null = null;
  let ballState: "dribble" | "pass" | "loose" | "shot" | "attempt" = "loose";
  let passTo: P | null = null;
  let decideT = 0;
  let settleT = 0; // just-gained-possession grace: no tackle for a beat (kills ball ping-pong)
  let scoreSide: Side | null = null;
  let attemptSide: Side | null = null;
  let attemptOnTarget = false;
  let restartFor: Side | null = null;
  let lastTouch: Side = poss;
  let pendingCross = false;
  let forceCross = false;
  let cornerDelivery = false;
  let freeKick = false;
  let matchProgress = 0;
  let captionText = "";
  let captionT = 0;
  let eventSeq = 0;
  let eventText = "";
  let wallPos = new Map<P, { x: number; y: number }>();

  const team = (s: Side) => (s === "home" ? home : away).filter((p) => !sentOff.has(p.id));
  const opp = (s: Side) => (s === "home" ? away : home).filter((p) => !sentOff.has(p.id));
  const outfield = (s: Side) => team(s).filter((p) => p.role !== "Goleiro");
  const keeper = (s: Side) => team(s).find((p) => p.role === "Goleiro") ?? team(s)[0];
  const ballSpeed = () => Math.hypot(ball.vx, ball.vy);
  const caption = (t: string) => { captionText = t; captionT = 1.0; };
  const ticker = (t: string) => { eventSeq += 1; eventText = t; };
  // eligible to contest: not sent off, and (a keeper only near its own goal)
  const canContest = (p: P) => !sentOff.has(p.id) && (p.role !== "Goleiro" || dist(ball.x, ball.y, OWN[p.side].x, OWN[p.side].y) < 22);

  function nearest(list: P[], x: number, y: number): P {
    let best = list[0];
    let bd = Infinity;
    for (const p of list) {
      const d = dist(p.x, p.y, x, y);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  function giveBallTo(p: P) {
    carrier = p;
    poss = p.side;
    lastTouch = p.side;
    ballState = "dribble";
    passTo = null;
    restartFor = null;
    attemptSide = null;
    pendingCross = false;
    forceCross = false;
    cornerDelivery = false;
    offsidePending = false;
    ball.vx *= 0.15;
    ball.vy *= 0.15;
    decideT = rnd(0.4, 0.9);
    settleT = 0.35; // protect the new carrier from an instant re-tackle
  }

  /** Is `rec` in an offside position for a forward pass, judged now? */
  function offsideAt(rec: P, side: Side): boolean {
    const up = side === "home";
    const ahead = up ? rec.y > ball.y + 1 : rec.y < ball.y - 1;
    if (!ahead) return false;
    if (up ? rec.y < 52 : rec.y > 48) return false; // must be in the attacking half
    const ys = opp(side).map((p) => p.y).sort((a, b) => (up ? b - a : a - b)); // deepest defender first
    const line = ys[1] ?? ys[0] ?? (up ? 100 : 0); // second-to-last defender
    return up ? rec.y > line + 1 : rec.y < line - 1;
  }

  function offside(x: number, y: number) {
    ball.x = x; ball.y = y; ball.vx = 0; ball.vy = 0;
    const defSide: Side = poss === "home" ? "away" : "home";
    giveBallTo(nearest(team(defSide), ball.x, ball.y));
    decideT = rnd(0.8, 1.2);
    caption("Impedimento!");
    ticker("Impedimento");
  }

  function kickoff(toSide: Side) {
    ball.x = 50; ball.y = 50; ball.vx = 0; ball.vy = 0;
    giveBallTo(nearest(team(toSide), 50, 50));
  }

  function throwIn(x: number, side: Side) {
    ball.x = clamp(x, 1, 99);
    ball.y = clamp(ball.y, 3, 97);
    ball.vx = 0; ball.vy = 0;
    ballState = "loose";
    restartFor = side;
    caption("Lateral");
  }

  function goalKick(side: Side, cap: string) {
    const g = OWN[side];
    ball.x = clamp(g.x + rnd(-10, 10), 6, 94);
    ball.y = side === "home" ? 11 : 89;
    ball.vx = 0; ball.vy = 0;
    giveBallTo(keeper(side));
    caption(cap);
  }

  function corner(attSide: Side) {
    ball.x = ball.x < 50 ? 2 : 98;
    ball.y = attSide === "home" ? 98 : 2;
    ball.vx = 0; ball.vy = 0;
    giveBallTo(nearest(outfield(attSide), ball.x, ball.y));
    forceCross = true;
    cornerDelivery = true;
    decideT = rnd(1.0, 1.5); // players crowd the box
    caption("Escanteio!");
    ticker("Escanteio");
  }

  function checkOut(): boolean {
    if (ball.x < 0.6) { throwIn(1, poss === "home" ? "away" : "home"); return true; }
    if (ball.x > 99.4) { throwIn(99, poss === "home" ? "away" : "home"); return true; }
    if (ball.y < 0.6) {
      if (lastTouch === "home") corner("away"); else goalKick("home", "Tiro de meta");
      return true;
    }
    if (ball.y > 99.4) {
      if (lastTouch === "away") corner("home"); else goalKick("away", "Tiro de meta");
      return true;
    }
    return false;
  }

  function shoot(p: P, header = false) {
    shots[p.side] += 1;
    lastTouch = p.side;
    const g = ATTACK[p.side];
    const acc = clamp((p.rating - 55) / 45, 0.3, 1) * (header ? 0.75 : 1);
    const dg = dist(ball.x, ball.y, g.x, g.y);
    const aimX = clamp(g.x + (1 - acc) * rnd(-9, 9) + rnd(-3, 3) + dg * 0.06 * rnd(-1, 1), 28, 72);
    attemptOnTarget = Math.abs(aimX - g.x) < 8;
    attemptSide = p.side;
    const d = Math.max(1, dist(ball.x, ball.y, aimX, g.y));
    const power = header ? 100 : 128;
    ball.vx = ((aimX - ball.x) / d) * power;
    ball.vy = ((g.y - ball.y) / d) * power;
    ballState = "attempt";
    carrier = null;
    passTo = null;
    pendingCross = false;
    caption(header ? "Cabeça!" : "Chute!");
    ticker(header ? "Cabeçada" : "Chute");
  }

  function card(p: P, type: Card) {
    if (type === "yellow" && bookings[p.id] === "yellow") type = "red"; // second yellow
    if (bookings[p.id] !== "red") bookings[p.id] = type;
    if (type === "red" && team(p.side).length > 8) sentOff.add(p.id); // sent off (keep ≥ 8 on the pitch)
    caption(type === "red" ? "Cartão vermelho!" : "Cartão amarelo!");
    ticker(type === "red" ? "🟥 Vermelho" : "🟨 Amarelo");
  }

  function foul(victim: P, fouler: P) {
    ball.x = victim.x; ball.y = victim.y; ball.vx = 0; ball.vy = 0;
    giveBallTo(nearest(team(victim.side), ball.x, ball.y));
    freeKick = true;
    decideT = rnd(1.0, 1.5); // dead ball — the wall forms
    caption("Falta!");
    ticker("Falta");
    if (R() < 0.25) card(fouler, R() < 0.06 ? "red" : "yellow");
  }

  function doCross(p: P) {
    const isCorner = cornerDelivery;
    forceCross = false;
    cornerDelivery = false;
    const home2 = p.side === "home";
    const boxY = home2 ? 86 : 14;
    const mates = outfield(p.side).filter((m) => m !== p);
    if (!mates.length) { decideT = rnd(0.4, 0.8); return; }
    let bx: number;
    if (isCorner) {
      const nearPost = ball.x < 50 ? 40 : 60;
      const farPost = ball.x < 50 ? 60 : 40;
      bx = R() < 0.5 ? nearPost : farPost;
    } else {
      bx = clamp((mates[0].x + 50) / 2 + rnd(-8, 8), 28, 72);
    }
    const tgt = mates.reduce((b, m) => (dist(m.x, m.y, bx, boxY) < dist(b.x, b.y, bx, boxY) ? m : b), mates[0]);
    const d = Math.max(1, dist(ball.x, ball.y, bx, boxY));
    const power = clamp(40 + d * 1.1, 45, 92);
    ball.vx = ((bx - ball.x) / d) * power;
    ball.vy = ((boxY - ball.y) / d) * power;
    ballState = "pass";
    passTo = tgt;
    pendingCross = true;
    lastTouch = p.side;
    caption(isCorner ? "Na área!" : "Cruzamento!");
  }

  function distribute(gk: P) {
    const dir = gk.side === "home" ? 1 : -1;
    const mates = outfield(gk.side);
    if (!mates.length) { decideT = rnd(0.4, 0.8); return; }
    const long = R() < 0.4;
    const tgt = long
      ? mates.reduce((b, m) => ((dir > 0 ? m.y > b.y : m.y < b.y) ? m : b), mates[0])
      : mates.reduce((b, m) => (dist(gk.x, gk.y, m.x, m.y) < dist(gk.x, gk.y, b.x, b.y) ? m : b), mates[0]);
    const acc = long ? 0.5 : 0.9;
    const lx = tgt.x + (1 - acc) * rnd(-11, 11);
    const d = Math.max(1, dist(ball.x, ball.y, lx, tgt.y));
    const power = clamp(30 + d * 1.2, 45, 115);
    ball.vx = ((lx - ball.x) / d) * power;
    ball.vy = ((tgt.y - ball.y) / d) * power;
    ballState = "pass";
    passTo = tgt;
    lastTouch = gk.side;
    if (long) { caption("Lançamento!"); ticker("Lançamento"); }
  }

  function decide() {
    if (!carrier) return;
    if (carrier.role === "Goleiro") { distribute(carrier); return; }
    if (forceCross) { doCross(carrier); return; }

    const side = carrier.side;
    const dir = side === "home" ? 1 : -1;
    const goal = ATTACK[side];
    const defenders = opp(side);
    const dg = dist(carrier.x, carrier.y, goal.x, goal.y);

    if (freeKick) {
      freeKick = false;
      if (dg < 26 && Math.abs(carrier.x - 50) < 16 && R() < 0.5) { shoot(carrier); return; } // direct free kick
    }

    // THROUGH ON GOAL: if only the keeper is between the carrier and the net (no
    // outfield defender goalside in the lane), FINISH — never pass backward. Kills
    // the "clean through 1-v-1 but passes back / to an opponent" artifact.
    const goalsideDefs = defenders.filter(
      (d) => d.role !== "Goleiro" && (dir > 0 ? d.y > carrier!.y + 1 : d.y < carrier!.y - 1) && Math.abs(d.x - carrier!.x) < 12,
    );
    const clearOnGoal = dg < 36 && goalsideDefs.length === 0;
    if (clearOnGoal) { shoot(carrier); return; }

    if (dg < 24) {
      const shootP = clamp(0.16 + (carrier.rating - 70) / 130, 0.08, 0.5) * (dg < 13 ? 1.7 : 1);
      if (R() < shootP) { shoot(carrier); return; }
    }
    if ((carrier.x < 24 || carrier.x > 76) && dg < 34 && R() < 0.45) { doCross(carrier); return; }

    if (dg < 26) {
      // lose it only to a defender actually CHALLENGING (a tackle), not a deliberate
      // giveaway to a distant opponent
      const d = nearest(defenders, carrier.x, carrier.y);
      if (dist(d.x, d.y, carrier.x, carrier.y) < 4 && R() < clamp(0.3 * (d.rating / carrier.rating), 0.08, 0.45)) { giveBallTo(d); return; }
    }

    const mates = outfield(side).filter((p) => p !== carrier);

    if (dg > 20 && mates.length && R() < 0.18) {
      const runners = mates.filter((m) => (side === "home" ? m.y > carrier!.y - 4 : m.y < carrier!.y + 4));
      if (runners.length) {
        const r = runners[Math.floor(R() * runners.length)];
        const tx = clamp(r.x + rnd(-5, 5), 8, 92);
        const ty = clamp(r.y + dir * rnd(10, 26), 6, 98);
        const d = Math.max(1, dist(ball.x, ball.y, tx, ty));
        const power = clamp(32 + d * 1.2, 48, 102);
        ball.vx = ((tx - ball.x) / d) * power;
        ball.vy = ((ty - ball.y) / d) * power;
        ballState = "pass";
        passTo = r;
        // through-balls in behind: offside if geometrically beyond the line, or a mistimed run
        offsidePending = offsideAt(r, side) || R() < 0.18;
        if (offsidePending) offsideT = 0.35;
        return;
      }
    }

    const pd = nearest(defenders, carrier.x, carrier.y);
    const pressed = dist(pd.x, pd.y, carrier.x, carrier.y) < 4.5;
    const scored = mates
      .map((m) => {
        const ahead = side === "home" ? m.y - carrier!.y : carrier!.y - m.y;
        const nd = nearest(defenders, m.x, m.y);
        // forward options strongly preferred; a backward option only wins when nothing
        // ahead is on (recycling under pressure), not on random noise.
        const prog = ahead >= 0 ? ahead * 1.3 : ahead * 2.6;
        return { m, s: prog + dist(nd.x, nd.y, m.x, m.y) - dist(carrier!.x, carrier!.y, m.x, m.y) * 0.25 + rnd(0, 3) };
      })
      .sort((a, b) => b.s - a.s);

    const passProb = pressed ? 0.92 : dg < 35 ? 0.8 : 0.66;
    if (scored.length && R() < passProb) {
      const tg = scored[Math.floor(R() * Math.min(3, scored.length))].m;
      const strayChance = clamp(0.26 - (carrier.rating - 70) / 110, 0.03, 0.32);
      const acc = clamp((carrier.rating - 55) / 45, 0.3, 1);
      const stray = R() < strayChance;
      let lx = tg.x + tg.vx * 0.16;
      let ly = tg.y + tg.vy * 0.16;
      const d0 = Math.max(1, dist(ball.x, ball.y, lx, ly));
      const ux = (lx - ball.x) / d0;
      const uy = (ly - ball.y) / d0;
      const err = (1 - acc) * rnd(-7, 7) + (stray ? rnd(-15, 15) : 0);
      lx += -uy * err;
      ly += ux * err;
      const d = Math.max(1, dist(ball.x, ball.y, lx, ly));
      const power = clamp(24 + d * 1.25, 38, 105);
      ball.vx = ((lx - ball.x) / d) * power;
      ball.vy = ((ly - ball.y) / d) * power;
      ballState = stray ? "loose" : "pass";
      passTo = stray ? null : tg;
      offsidePending = !stray && offsideAt(tg, side);
      if (offsidePending) offsideT = 0.35;
    } else {
      decideT = rnd(0.4, 0.85);
    }
  }

  function integrateBall(dt: number, friction: number) {
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    const f = Math.exp(-friction * dt);
    ball.vx *= f;
    ball.vy *= f;
  }

  function target(p: P, presser: boolean, chase: boolean): { tx: number; ty: number } {
    const wp = wallPos.get(p);
    if (wp) return { tx: wp.x, ty: wp.y };
    if (chase) return { tx: ball.x + ball.vx * 0.12, ty: ball.y + ball.vy * 0.12 };
    const up = p.side === "home";
    const dir = up ? 1 : -1;

    if (p.role === "Goleiro") {
      const g = OWN[p.side];
      let gx = clamp(50 + (ball.x - 50) * 0.4, 37, 63);
      let gy = g.y + dir * 6;
      const shotComing = (ballState === "attempt" || ballState === "shot") && attemptSide !== p.side && scoreSide !== p.side;
      if (shotComing && (ballState === "attempt" ? attemptSide : scoreSide)) { gx = clamp(ball.x, 34, 66); gy = g.y + dir * 4; }
      if (p === carrier) { gx = clamp(50 + (ball.x - 50) * 0.2, 42, 58); gy = g.y + dir * 8; }
      return { tx: gx, ty: gy };
    }

    // corner: attackers crowd the box near/far post, defenders drop in to guard
    if (cornerDelivery) {
      const attackY = up ? 84 : 16;
      if (p.side === poss && p.role !== "Defensor") return { tx: clamp(30 + (p.ax) * 0.4 + rnd(-4, 4), 30, 70), ty: attackY + rnd(-3, 3) };
      if (p.side !== poss) return { tx: clamp(34 + p.ax * 0.3, 30, 70), ty: (up ? 92 : 8) + rnd(-4, 4) };
    }

    if (p.side === poss) {
      if (p === carrier) {
        const g = ATTACK[p.side];
        return { tx: clamp(ball.x + (g.x - ball.x) * 0.08 + rnd(-4, 4), 8, 92), ty: clamp(ball.y + dir * rnd(5, 10), 6, 94) };
      }
      let sy: number;
      if (p.role === "Atacante") sy = ball.y + dir * rnd(8, 30); // strikers gamble on runs in behind
      else if (p.role === "Meio-campo") sy = ball.y + dir * rnd(-4, 12);
      else sy = ball.y + dir * rnd(-20, -8);
      const baseX = clamp(p.ax + (ball.x - 50) * 0.22, 7, 93);
      const wide = p.ax < 50 ? ball.x - rnd(8, 22) : ball.x + rnd(8, 22);
      return { tx: clamp((wide + baseX) / 2, 8, 92), ty: clamp(sy, 6, 94) };
    }

    if (presser) return { tx: ball.x + ball.vx * 0.1 + rnd(-2, 2), ty: ball.y + (up ? -2 : 2) };
    // Off the ball, HOLD FORMATION SHAPE — anchor to the home slot and only SHIFT
    // toward the ball, instead of everyone collapsing onto it (the "swarm").
    if (p.role === "Defensor") {
      const lo = up ? 10 : 55;
      const hi = up ? 45 : 90;
      // flat back line that slides with the ball but keeps its lateral slot
      return { tx: clamp(p.ax * 0.7 + ball.x * 0.3, 12, 88), ty: clamp(ball.y - dir * 22, lo, hi) };
    }
    const g = OWN[p.side];
    // midfielders keep a compact band: mostly their slot, shifted toward the ball
    return { tx: clamp(p.ax * 0.6 + ball.x * 0.4, 8, 92), ty: clamp(p.ay * 0.4 + ball.y * 0.4 + g.y * 0.2, 6, 94) };
  }

  function steer(p: P, sprint: boolean, dt: number) {
    const dx = p.tx - p.x;
    const dy = p.ty - p.y;
    const d = Math.hypot(dx, dy);
    const stam = 1 - matchProgress * clamp(0.3 - (p.rating - 70) / 220, 0.14, 0.32);
    const maxS = (sprint ? SPRINT : JOG) * p.pace * stam;
    let desx = 0;
    let desy = 0;
    if (d > 0.001) {
      const s = d < 5 ? maxS * (d / 5) : maxS;
      desx = (dx / d) * s;
      desy = (dy / d) * s;
    }
    let ax = desx - p.vx;
    let ay = desy - p.vy;
    const am = Math.hypot(ax, ay);
    const amax = ACCEL * dt;
    if (am > amax) { ax = (ax / am) * amax; ay = (ay / am) * amax; }
    p.vx += ax;
    p.vy += ay;
    p.x = clamp(p.x + p.vx * dt, 2, 98);
    p.y = clamp(p.y + p.vy * dt, 2, 98);
  }

  function separate(dt: number) {
    const SEP = 4.2;
    for (let i = 0; i < all.length; i++) {
      if (sentOff.has(all[i].id)) continue;
      for (let j = i + 1; j < all.length; j++) {
        if (sentOff.has(all[j].id)) continue;
        const a = all[i];
        const b = all[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d > 0.01 && d < SEP) {
          const push = ((SEP - d) / SEP) * 7 * dt;
          const ux = dx / d;
          const uy = dy / d;
          a.x = clamp(a.x - ux * push, 2, 98); a.y = clamp(a.y - uy * push, 2, 98);
          b.x = clamp(b.x + ux * push, 2, 98); b.y = clamp(b.y + uy * push, 2, 98);
        }
      }
    }
  }

  function updateWall() {
    wallPos = new Map();
    if (!freeKick) return;
    const dSide: Side = poss === "home" ? "away" : "home";
    const g = OWN[dSide];
    if (dist(ball.x, ball.y, g.x, g.y) > 36) return; // wall only near goal
    const dx = g.x - ball.x;
    const dy = g.y - ball.y;
    const dl = Math.hypot(dx, dy) || 1;
    const wx = ball.x + (dx / dl) * 9;
    const wy = ball.y + (dy / dl) * 9;
    const px = -dy / dl;
    const py = dx / dl;
    const defs = team(dSide).filter((p) => p.role !== "Goleiro").sort((a, b) => dist(a.x, a.y, wx, wy) - dist(b.x, b.y, wx, wy));
    defs.slice(0, 3).forEach((p, i) => {
      const off = (i - 1) * 2.4;
      wallPos.set(p, { x: clamp(wx + px * off, 4, 96), y: clamp(wy + py * off, 4, 96) });
    });
  }

  function step(dt: number, progress = 0) {
    dt = Math.min(dt, 0.05);
    matchProgress = clamp(progress, 0, 1);
    if (captionT > 0) captionT -= dt;
    if (settleT > 0) settleT -= dt;
    if (ballState === "dribble" || ballState === "pass") possFrames[poss] += 1;
    updateWall();

    if (ballState === "shot" && scoreSide) {
      integrateBall(dt, SHOT_FRICTION);
      if (scoreSide === "home" ? ball.y >= 97 : ball.y <= 3) {
        const conceding: Side = scoreSide === "home" ? "away" : "home";
        scoreSide = null;
        kickoff(conceding);
      }
    } else if (ballState === "attempt" && attemptSide) {
      integrateBall(dt, SHOT_FRICTION);
      const defSide: Side = attemptSide === "home" ? "away" : "home";
      const blocker = team(defSide).find((d) => dist(d.x, d.y, ball.x, ball.y) < BLOCK_R);
      if (blocker) {
        if (blocker.role === "Goleiro") { goalKick(defSide, "Defesa!"); ticker("Defesa"); }
        else {
          ball.vx = ball.vx * -0.25 + rnd(-14, 14);
          ball.vy = ball.vy * -0.25 + rnd(-6, 6);
          ballState = "loose";
          lastTouch = defSide;
          caption("Bloqueio!");
          ticker("Bloqueio");
        }
        attemptSide = null;
      } else {
        const reached = attemptSide === "home" ? ball.y >= 95 : ball.y <= 5;
        if (reached) {
          if (attemptOnTarget) {
            if (R() < 0.55) { goalKick(defSide, "Defesa!"); ticker("Defesa"); }
            else {
              ball.y = attemptSide === "home" ? 88 : 12;
              ball.x = clamp(ball.x + rnd(-6, 6), 8, 92);
              ball.vx = rnd(-16, 16);
              ball.vy = attemptSide === "home" ? -20 : 20;
              ballState = "loose";
              lastTouch = defSide;
              attemptSide = null;
              caption("Rebote!");
            }
          } else {
            goalKick(defSide, "Pra fora!");
          }
        } else if (checkOut()) {
          attemptSide = null;
        }
      }
    } else if (ballState === "pass" && passTo) {
      integrateBall(dt, BALL_FRICTION);
      if (offsidePending) {
        offsideT -= dt;
        if (offsideT <= 0) { offsidePending = false; offside(ball.x, ball.y); } // flag up
      } else if (!checkOut()) {
        const rec = passTo;
        const int = nearest(opp(rec.side).filter(canContest), ball.x, ball.y);
        const intReach = CONTROL * (0.85 + (int.rating - 70) / 110);
        if (dist(ball.x, ball.y, rec.x, rec.y) < CONTROL) {
          if (pendingCross && rec.role !== "Goleiro") { pendingCross = false; lastTouch = rec.side; shoot(rec, true); }
          else giveBallTo(rec);
        } else if (dist(int.x, int.y, ball.x, ball.y) < intReach) { pendingCross = false; giveBallTo(int); }
        else if (ballSpeed() < 4) { pendingCross = false; ballState = "loose"; }
      }
    } else if (ballState === "dribble" && carrier) {
      const sp = Math.hypot(carrier.vx, carrier.vy);
      const dir = carrier.side === "home" ? 1 : -1;
      const dx = sp > 1 ? carrier.vx / sp : 0;
      const dy = sp > 1 ? carrier.vy / sp : dir;
      ball.x = lerp(ball.x, carrier.x + dx * DRIBBLE_LEAD, Math.min(1, 15 * dt));
      ball.y = lerp(ball.y, carrier.y + dy * DRIBBLE_LEAD, Math.min(1, 15 * dt));
      ball.vx = carrier.vx;
      ball.vy = carrier.vy;
      decideT -= dt;
      const presser = nearest(opp(carrier.side).filter((p) => p.role !== "Goleiro"), carrier.x, carrier.y);
      const near = dist(presser.x, presser.y, carrier.x, carrier.y) < 4.0;
      // fouls now come from LEGIT challenges (the scramble ping-pong that used to
      // manufacture them is fixed), so the per-challenge rate is higher to keep a
      // realistic ~2-4 bookings/match.
      const foulRate = clamp(1.1 * (carrier.rating / presser.rating), 0.6, 1.9);
      const tackleRate = clamp(TACKLE_RATE * (presser.rating / carrier.rating), 1.4, 6);
      if (settleT > 0) { if (decideT <= 0) decide(); } // grace window — dribble/decide, can't be tackled yet
      else if (near && R() < foulRate * dt) foul(carrier, presser);
      else if (near && R() < tackleRate * dt) giveBallTo(presser);
      else if (decideT <= 0) decide();
    } else {
      integrateBall(dt, BALL_FRICTION);
      if (!checkOut()) {
        const pool = (restartFor ? team(restartFor) : all).filter(canContest);
        let best = pool[0] ?? all[0];
        let bd = Infinity;
        for (const p of pool) {
          const d = dist(p.x, p.y, ball.x, ball.y) - (p.rating - 70) / 12;
          if (d < bd) { bd = d; best = p; }
        }
        if (best && dist(best.x, best.y, ball.x, ball.y) < CONTROL) {
          const g = ATTACK[best.side];
          const own = OWN[best.side];
          if (best.role === "Goleiro" && ballSpeed() < 24 && dist(ball.x, ball.y, own.x, own.y) < 12) {
            // keeper smothers a slow loose ball in its own box → dead ball, ends the
            // keeper/attacker scramble instead of ping-ponging possession
            giveBallTo(best);
            settleT = 0.9; // the keeper has it safe for a beat before distributing
            caption("Defesa do goleiro!");
            ticker("Defesa");
          } else if (best.role !== "Goleiro" && dist(best.x, best.y, g.x, g.y) < 16 && R() < 0.6) { lastTouch = best.side; shoot(best); }
          else giveBallTo(best);
        }
      }
    }

    const defenders = opp(poss).filter((p) => p.role !== "Goleiro");
    const byBall = [...defenders].sort((a, b) => dist(a.x, a.y, ball.x, ball.y) - dist(b.x, b.y, ball.x, ball.y));
    // Press with the nearest defender always, and a SECOND to double up — the
    // rating-driven tackle pressure this creates is what makes a stronger XI win the
    // ball back and dominate. (Anti-swarm comes from the OFF-BALL players now holding
    // formation shape in target(), not from removing pressers.)
    const pressers = byBall.slice(0, 2);
    let chaseA: P | null = null;
    let chaseB: P | null = null;
    if (ballState === "pass" && passTo) { chaseA = passTo; chaseB = nearest(opp(passTo.side).filter(canContest), ball.x, ball.y); }
    else if (ballState === "loose") { chaseA = nearest((restartFor ? team(restartFor) : all).filter(canContest), ball.x, ball.y); }

    for (const p of all) {
      if (sentOff.has(p.id)) continue; // sent off — off the pitch
      p.rt -= dt;
      const chasing = p === chaseA || p === chaseB;
      if (p === carrier || chasing || p.rt <= 0 || wallPos.has(p) || cornerDelivery) {
        const t = target(p, pressers.includes(p), chasing);
        p.tx = t.tx; p.ty = t.ty;
        p.rt = p === carrier || chasing ? 0.1 : rnd(0.35, 0.8);
      }
      const sprint = p === carrier || chasing || pressers.includes(p) || ballState === "attempt";
      steer(p, sprint, dt);
    }
    separate(dt);
  }

  function scoreFor(side: Side) {
    scoreSide = side;
    ballState = "shot";
    attemptSide = null;
    const g = ATTACK[side];
    const shooter = nearest(outfield(side), g.x, g.y);
    // The authoritative goal is positionless, but it must LOOK like a real finish:
    // reveal it from a plausible box position (bring a deep finisher up), never from
    // midfield. Kills the "goal launched from the centre circle" artifact.
    const fy = side === "home"
      ? (shooter.y < 78 ? rnd(80, 91) : Math.min(shooter.y, 95))
      : (shooter.y > 22 ? rnd(9, 20) : Math.max(shooter.y, 5));
    const fx = clamp(shooter.x, 32, 68);
    shooter.x = fx; shooter.y = fy; // the finisher is on the ball
    poss = side;
    carrier = null;
    ball.x = fx;
    ball.y = fy;
    const cx = clamp(50 + (R() < 0.5 ? -1 : 1) * rnd(9, 15), 33, 67); // into a corner, past the keeper
    // Aim at the goal-LINE crossing point (where the shot is caught), so the ball is
    // in the corner AT the line — from a short box distance it wouldn't drift there
    // if aimed at y=g.y (it gets caught mid-drift, looking central).
    const catchY = side === "home" ? 97 : 3;
    const d = Math.max(1, dist(ball.x, ball.y, cx, catchY));
    ball.vx = ((cx - ball.x) / d) * 122;
    ball.vy = ((catchY - ball.y) / d) * 122;
    ticker("⚽ GOL");
  }

  function snapshot(): Snapshot {
    const totalP = possFrames.home + possFrames.away;
    return {
      home: home.map((p) => ({ x: p.x, y: p.y })),
      away: away.map((p) => ({ x: p.x, y: p.y })),
      ball: { x: ball.x, y: ball.y },
      poss,
      controlled: ballState === "dribble" || ballState === "pass",
      caption: captionT > 0 ? captionText : null,
      shots: { home: shots.home, away: shots.away },
      possHome: totalP ? possFrames.home / totalP : 0.5,
      bookings: { ...bookings },
      sentOff: [...sentOff],
      eventSeq,
      eventText,
    };
  }

  return { step, snapshot, scoreFor };
}
