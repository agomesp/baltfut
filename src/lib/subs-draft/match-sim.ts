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
import { TOTAL_STEPS } from "./sim-timing";
import type { Cat } from "./data";
import type { FieldSlot } from "./squad";

const FULL_MIN = 90; // a match is 90 minutes for the recorded event timestamps

/** A goal/card the pitch actually PRODUCED (xG-unification: the scoreline emerges
 * from play). Side-keyed + team-agnostic so the sim stays standalone. */
export interface PitchEvent {
  minute: number;
  side: Side;
  type: "goal" | "yellow" | "red";
  player: string;
  playerId: string;
}
/** Per-side match-stat counters the pitch produced — the calibration harness gates
 * these against real-football bands, and a match-stats panel can render them. */
export interface PitchStats {
  shots: { home: number; away: number };
  onTarget: { home: number; away: number };
  corners: { home: number; away: number };
  fouls: { home: number; away: number }; // committed BY that side
}
export interface PitchResult {
  goals: { home: number; away: number };
  events: PitchEvent[];
  stats: PitchStats;
}

export type Side = "home" | "away";
export type Card = "yellow" | "red";
export interface Snapshot {
  home: { x: number; y: number }[];
  away: { x: number; y: number }[];
  ball: { x: number; y: number; z: number };
  poss: Side;
  controlled: boolean;
  caption: string | null;
  shots: { home: number; away: number };
  /** Live tally the pitch has PRODUCED (only moves when scoring is on; stays 0/0 in
   * the cosmetic v1 path where scoreFor() is authoritative instead). */
  goals: { home: number; away: number };
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
  /** The full-time result the pitch PRODUCED (xG-unification). Only meaningful when
   * created with {scoring:true}; otherwise goals stay 0-0 with no events. */
  getResult(): PitchResult;
}

interface P {
  id: string;
  name: string;
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
const GRAVITY = 52; // ball-height (z) fall rate — crosses/corners/long balls arc

const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.min(1, t);

/**
 * How CLEAR a pass/shot lane is: the smallest perpendicular distance of any point
 * in `list` whose projection falls BETWEEN the endpoints. Large = an open lane; small
 * = a defender sitting in the pass. The utility AI uses this so passes "see" the
 * defence instead of firing blind.
 */
export function laneClearance(fx: number, fy: number, tx: number, ty: number, list: { x: number; y: number }[]): number {
  const dx = tx - fx;
  const dy = ty - fy;
  const len2 = dx * dx + dy * dy || 1;
  const len = Math.sqrt(len2);
  let min = 99;
  for (const p of list) {
    const t = ((p.x - fx) * dx + (p.y - fy) * dy) / len2;
    if (t <= 0.05 || t >= 0.98) continue; // only bodies between the two points
    const perp = Math.abs((p.x - fx) * dy - (p.y - fy) * dx) / len;
    if (perp < min) min = perp;
  }
  return min;
}

// A0 keystone: the whole sim draws from ONE seeded stream (see prng.ts), so the
// same seed replays the exact same match. `seed` defaults to entropy → the UI and
// variety-seeking tests behave randomly as before; pass a seed for a fixed replay.
export function createMatchSim(
  homeSlots: FieldSlot[],
  awaySlots: FieldSlot[],
  seed: number = randInt32(),
  opts: { scoring?: boolean } = {},
): MatchSim {
  // xG-unification: when scoring is on, the pitch PRODUCES the scoreline (goals emerge
  // from resolved chances) and progress is driven by an internal fixed-step counter so
  // a headless run and the live spotlight land on the identical result. Off (the v1
  // default) the sim stays purely cosmetic — no goals, external progress.
  const scoring = opts.scoring ?? false;
  const R = mulberry32(seed);
  const rnd = (a: number, b: number) => a + R() * (b - a);
  const mk = (s: FieldSlot, side: Side): P => ({
    id: s.id, name: s.name, side, role: s.role, rating: s.rating ?? 78, ax: s.x, ay: s.y, x: s.x, y: s.y, vx: 0, vy: 0, tx: s.x, ty: s.y, rt: 0,
    pace: 0.85 + ((s.rating ?? 78) - 70) / 60,
  });
  const home = homeSlots.map((s) => mk(s, "home"));
  const away = awaySlots.map((s) => mk(s, "away"));
  const all = [...home, ...away];
  const ball = { x: 50, y: 50, vx: 0, vy: 0, z: 0, vz: 0 }; // z = height above the pitch
  const shots = { home: 0, away: 0 };
  const onTarget = { home: 0, away: 0 };
  const corners = { home: 0, away: 0 };
  const foulsBy = { home: 0, away: 0 };
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
  let breakT = 0; // counter-attack window after a live turnover (see giveBallTo)
  let breakSide: Side | null = null;
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
  let stepIndex = 0; // fixed-step counter — the authoritative clock when scoring
  let captionText = "";
  let captionT = 0;
  let eventSeq = 0;
  let eventText = "";
  let wallPos = new Map<P, { x: number; y: number }>();

  // xG-unification produced state (all inert when scoring is off)
  const goals = { home: 0, away: 0 };
  const recorded: PitchEvent[] = [];
  let attemptXG = 0; // captured at the strike, resolved when the shot reaches the line
  let attemptShooter: P | null = null;
  let attemptKeeper: P | null = null;
  const nowMin = () => clamp(Math.round(matchProgress * FULL_MIN), 1, FULL_MIN);
  const record = (type: PitchEvent["type"], side: Side, p: P) => {
    recorded.push({ minute: nowMin(), side, type, player: p.name, playerId: p.id });
  };

  // GAME STATE: how hard a side is chasing (+1) or protecting (-1) the scoreline,
  // ramping in over the final third. Reads only PRODUCED state — goals stay 0-0 on the
  // cosmetic path, so urgency is inert there. This is what makes 1-0 at 80' feel like
  // 1-0 at 80': the trailing side pushes up and shoots; the leader sits deep and slows.
  const urgency = (s: Side) => {
    const diff = s === "home" ? goals.away - goals.home : goals.home - goals.away;
    return clamp(diff, -1, 1) * clamp((matchProgress - 0.6) / 0.3, 0, 1);
  };

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
      // squared distance — argmin is identical to hypot's, no sqrt (called many
      // times per step; the selection is bit-identical so determinism is preserved)
      const dx = p.x - x, dy = p.y - y;
      const d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  function giveBallTo(p: P) {
    // COUNTER-ATTACK window: winning the ball in LIVE play (a tackle/interception — the
    // restart fns clear this right after) opens a short break where the regaining side
    // plays faster + more vertical while the conceding side is momentarily out of shape.
    // Real turnovers → fast breaks is the single most-missed transition in football.
    const liveSteal = (ballState === "dribble" || ballState === "pass") && !freeKick && p.side !== poss;
    if (liveSteal) { breakT = 3.5; breakSide = p.side; }
    else if (breakSide !== null && p.side !== breakSide) { breakT = 0; breakSide = null; } // changed hands — break over
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
    ball.z = 0; ball.vz = 0; // controlled → at the player's feet
    decideT = liveSteal ? rnd(0.15, 0.4) : rnd(0.4, 0.9); // a stolen ball launches at once
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
    breakT = 0; breakSide = null; // dead ball — any break is over
    ticker("Impedimento");
  }

  function kickoff(toSide: Side) {
    breakT = 0; breakSide = null; // dead ball — any break is over
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
    breakT = 0; breakSide = null; // dead ball — any break is over
  }

  function goalKick(side: Side, cap: string) {
    const g = OWN[side];
    ball.x = clamp(g.x + rnd(-10, 10), 6, 94);
    ball.y = side === "home" ? 11 : 89;
    ball.vx = 0; ball.vy = 0;
    giveBallTo(keeper(side));
    caption(cap);
    breakT = 0; breakSide = null; // dead ball — any break is over
  }

  function corner(attSide: Side) {
    corners[attSide] += 1;
    ball.x = ball.x < 50 ? 2 : 98;
    ball.y = attSide === "home" ? 98 : 2;
    ball.vx = 0; ball.vy = 0;
    giveBallTo(nearest(outfield(attSide), ball.x, ball.y));
    forceCross = true;
    cornerDelivery = true;
    decideT = rnd(1.0, 1.5); // players crowd the box
    caption("Escanteio!");
    breakT = 0; breakSide = null; // dead ball — any break is over
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
    // Aim error wide enough that MISSES genuinely happen (real football: only ~a third
    // of shots hit the frame). Range and poor finishing widen the spray; the calibration
    // harness gates the on-target fraction. Misses go out for goal kicks; deflected/
    // parried attempts go behind for corners — the whole byline ecosystem needs these.
    const aimX = clamp(g.x + (1 - acc) * rnd(-16, 16) + rnd(-6, 6) + dg * 0.14 * rnd(-1, 1), 20, 80);
    attemptOnTarget = Math.abs(aimX - g.x) < 8;
    attemptSide = p.side;
    if (scoring) {
      // xG for THIS strike — angle (central > wide), distance, finishing. Pure
      // arithmetic (no R() draws) so the flag-off cursor is untouched; resolved into
      // a goal/save when the shot reaches the line.
      const shotAngle = 1 - Math.abs(ball.x - 50) / 50; // 1 central, 0 by the touchline
      const distF = clamp(1 - (dg - 6) / 34, 0.05, 1); // 1 in the six-yard box → ~0 at range
      const finish = clamp((p.rating - 55) / 45, 0.25, 1) * (header ? 0.72 : 1);
      attemptXG = clamp(0.09 + 0.62 * distF * (0.45 + 0.55 * shotAngle) * (0.55 + 0.45 * finish), 0.02, 0.83);
      attemptShooter = p;
      attemptKeeper = keeper(p.side === "home" ? "away" : "home");
    }
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
    if (scoring) record(type, p.side, p); // a second-yellow records as its resulting red (still a ban)
    caption(type === "red" ? "Cartão vermelho!" : "Cartão amarelo!");
    ticker(type === "red" ? "🟥 Vermelho" : "🟨 Amarelo");
  }

  /** A goal the pitch PRODUCED (scoring path only): tally it, log the scorer, restart
   * with the conceding side kicking off. This is the xG-unification counterpart of the
   * cosmetic scoreFor() — here the scoreline is an OUTPUT of play, not an input. */
  function goal(side: Side, shooter: P) {
    goals[side] += 1;
    record("goal", side, shooter);
    caption("GOL!");
    ticker("⚽️ GOL");
    kickoff(side === "home" ? "away" : "home"); // the team that conceded restarts
  }

  function foul(victim: P, fouler: P) {
    foulsBy[fouler.side] += 1;
    ball.x = victim.x; ball.y = victim.y; ball.vx = 0; ball.vy = 0;
    giveBallTo(nearest(team(victim.side), ball.x, ball.y));
    freeKick = true;
    decideT = rnd(1.0, 1.5); // dead ball — the wall forms
    caption("Falta!");
    breakT = 0; breakSide = null; // dead ball — any break is over
    ticker("Falta");
    // ~22% of fouls booked (3.5% straight red) → real ~3.5 yellows + ~0.2 reds. Fouls
    // concentrate on the pressers, so an ALREADY-BOOKED fouler is carded again at a
    // reduced rate — the ref's second-yellow reluctance + the player easing off; without
    // it, second yellows stacked into ~0.8 reds/match (real ~0.2).
    if (R() < (bookings[fouler.id] ? 0.09 : 0.22)) card(fouler, R() < 0.035 ? "red" : "yellow");
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
    ball.z = 0;
    ball.vz = isCorner ? rnd(24, 32) : rnd(18, 26); // loft it into the box — an arcing delivery
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
    const long = R() < (urgency(gk.side) > 0.3 ? 0.65 : 0.4); // chasing late → hurry it long
    const tgt = long
      ? mates.reduce((b, m) => ((dir > 0 ? m.y > b.y : m.y < b.y) ? m : b), mates[0])
      : mates.reduce((b, m) => (dist(gk.x, gk.y, m.x, m.y) < dist(gk.x, gk.y, b.x, b.y) ? m : b), mates[0]);
    const acc = long ? 0.5 : 0.9;
    const lx = tgt.x + (1 - acc) * rnd(-11, 11);
    const d = Math.max(1, dist(ball.x, ball.y, lx, tgt.y));
    const power = clamp(30 + d * 1.2, 45, 115);
    ball.vx = ((lx - ball.x) / d) * power;
    ball.vy = ((tgt.y - ball.y) / d) * power;
    ball.z = 0;
    ball.vz = long ? rnd(26, 36) : 0; // a long clearance is lofted; a short throw stays low
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

    // ── UTILITY AI: score every option, then pick (a better player picks the best
    // more reliably). Passes are penalized by INTERCEPT RISK — the clearance of the
    // pass lane — so they stop firing blind; shooting is an xG estimate (distance ×
    // angle × how clear the shot lane is); dribbling holds the ball into space.
    const mates = outfield(side).filter((p) => p !== carrier);
    const oppOut = defenders.filter((d) => d.role !== "Goleiro");
    const opps = oppOut.length ? oppOut : defenders;
    const pd = nearest(defenders, carrier.x, carrier.y);
    const pressed = dist(pd.x, pd.y, carrier.x, carrier.y) < 4.5;

    type Opt = { kind: "shoot" | "cross" | "pass" | "dribble"; target?: P; score: number };
    const opts: Opt[] = [];

    // SHOOT — an xG-ish estimate. The 1.55 appetite gain targets the real ~10-12
    // shots/team (was ~7): speculative range efforts now exist AND genuinely miss
    // (the widened aim spray), so extra volume doesn't inflate goals.
    const angle = 1 - Math.abs(carrier.x - 50) / 50; // 1 central, 0 at the touchline
    const distF = clamp(1 - (dg - 6) / 36, 0, 1); // 1 close, 0 by ~42 out
    const shotLane = clamp(laneClearance(carrier.x, carrier.y, goal.x, goal.y, oppOut) / 6, 0, 1);
    const xg = distF * (0.35 + 0.65 * angle) * (0.25 + 0.75 * shotLane);
    // the flat 0.14 term is the SPECULATIVE appetite: in range but with weak pass
    // options, real players let fly from distance — those low-xG efforts mostly miss
    // (the aim spray) or get blocked, supplying the real ~12 shots/team + the byline
    // ecosystem (goal kicks, corners) without inflating goals. A side CHASING the
    // scoreline late shoots more (urgency) — the real late-goal surge.
    const u = urgency(side);
    opts.push({ kind: "shoot", score: (xg * 2.6 + (dg < 30 ? 0.14 : 0)) * (1 + 0.5 * Math.max(0, u)) });

    // CROSS from wide + advanced
    if ((carrier.x < 26 || carrier.x > 74) && dg < 36) {
      const boxMates = mates.filter((m) => (dir > 0 ? m.y > 76 : m.y < 24)).length;
      opts.push({ kind: "cross", score: 0.32 + boxMates * 0.16 });
    }

    // PASS to each mate — progress × openness × lane-safety × sensible range.
    // On the BREAK, forward progress is worth more (vertical, direct play while the
    // opponent is out of shape) — the counter-attack's decision signature.
    const breaking = breakT > 0 && breakSide === side;
    for (const m of mates) {
      const ahead = dir > 0 ? m.y - carrier.y : carrier.y - m.y;
      const nd = nearest(opps, m.x, m.y);
      const openness = clamp(dist(nd.x, nd.y, m.x, m.y) / 12, 0.05, 1);
      const lane = clamp(laneClearance(ball.x, ball.y, m.x, m.y, oppOut) / 5, 0, 1);
      const range = dist(carrier.x, carrier.y, m.x, m.y);
      // a leader protecting the scoreline keeps it SHORT and safe (recenter ~15)
      const rangeF = clamp(1 - Math.abs(range - (u < -0.3 ? 15 : 20)) / 46, 0.25, 1);
      const progF = clamp(0.5 + ahead / 38, 0.05, 1.25) * (breaking && ahead > 0 ? 1.35 : 1);
      opts.push({ kind: "pass", target: m, score: progF * (0.4 + 0.6 * openness) * (0.3 + 0.7 * lane) * rangeF });
    }

    // DRIBBLE — hold the ball, drive into space (worse under pressure)
    const carryLane = clamp(laneClearance(carrier.x, carrier.y, carrier.x, goal.y, oppOut) / 12, 0, 1);
    opts.push({ kind: "dribble", score: 0.34 + carryLane * 0.34 - (pressed ? 0.28 : 0) });

    // pick — a higher-rated carrier takes the top option more reliably
    opts.sort((a, b) => b.score - a.score);
    const bias = clamp((carrier.rating - 58) / 40, 0.25, 0.94);
    let chosen = opts[0];
    if (opts.length > 1 && R() > bias) chosen = opts[1 + Math.floor(R() * Math.min(2, opts.length - 1))];

    if (chosen.kind === "shoot") { shoot(carrier); return; }
    if (chosen.kind === "cross") { doCross(carrier); return; }
    // a leader on the ball late slows the game down (time management on the dribble)
    if (chosen.kind === "dribble" || !chosen.target) { decideT = rnd(0.35, 0.75) * (u < -0.3 ? 1.35 : 1); return; }

    // PASS — accuracy + stray + through-ball lead + offside
    const tg = chosen.target;
    const aheadTg = dir > 0 ? tg.y - carrier.y : carrier.y - tg.y;
    const through = aheadTg > 8 && R() < (breaking ? 0.7 : 0.5); // slipped ahead of a run — likelier on the break
    const strayChance = clamp(0.24 - (carrier.rating - 70) / 120, 0.03, 0.3);
    const acc = clamp((carrier.rating - 55) / 45, 0.3, 1);
    const stray = R() < strayChance;
    let lx = tg.x + tg.vx * 0.16;
    let ly = tg.y + tg.vy * 0.16 + (through ? dir * rnd(8, 20) : 0);
    const d0 = Math.max(1, dist(ball.x, ball.y, lx, ly));
    const ux = (lx - ball.x) / d0;
    const uy = (ly - ball.y) / d0;
    const err = (1 - acc) * rnd(-7, 7) + (stray ? rnd(-15, 15) : 0);
    lx += -uy * err;
    ly += ux * err;
    const d = Math.max(1, dist(ball.x, ball.y, lx, ly));
    const power = clamp(24 + d * 1.25, 38, 108);
    ball.vx = ((lx - ball.x) / d) * power;
    ball.vy = ((ly - ball.y) / d) * power;
    ballState = stray ? "loose" : "pass";
    passTo = stray ? null : tg;
    offsidePending = !stray && (offsideAt(tg, side) || (through && R() < 0.15));
    if (offsidePending) offsideT = 0.35;
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
      // SWEEP: a ball played in behind that will DIE near his goal, with the keeper
      // clearly first to it → he comes off his line and claims it instead of statuing
      // on the line while a through-ball rolls past (the most video-gamey artifact the
      // audit found). Arrival point is closed-form from the rolling friction; a better
      // keeper is braver (bigger radius). canContest already lets him win it ≤22 out.
      if (!shotComing && p !== carrier && (ballState === "pass" || ballState === "loose") && ball.vy * dir < -4) {
        const ax2 = ball.x + ball.vx / BALL_FRICTION; // where the roll dies
        const ay2 = ball.y + ball.vy / BALL_FRICTION;
        const radius = clamp(12 + (p.rating - 70) / 3, 10, 18);
        if (dist(ax2, ay2, g.x, g.y) < radius) {
          // the keeper goes on ROUGHLY EQUAL balls — his reach + hands win the tie, so
          // he only stays home when the striker is clearly first (real sweeps ~1-3/match)
          const rival = nearest(outfield(p.side === "home" ? "away" : "home"), ax2, ay2);
          if (dist(p.x, p.y, ax2, ay2) - 1 < dist(rival.x, rival.y, ax2, ay2)) {
            return { tx: clamp(ax2, 20, 80), ty: dir > 0 ? clamp(ay2, 2, 45) : clamp(ay2, 55, 98) };
          }
        }
      }
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
      // deeper gambles on the break (defence out of shape) AND when chasing late (risk-on)
      const pushOn = (breakT > 0 && breakSide === p.side) || urgency(p.side) > 0.3;
      let sy: number;
      if (p.role === "Atacante") sy = ball.y + dir * (pushOn ? rnd(14, 40) : rnd(8, 30));
      else if (p.role === "Meio-campo") sy = ball.y + dir * (pushOn ? rnd(2, 18) : rnd(-4, 12));
      else sy = ball.y + dir * rnd(-14, -6); // fullbacks push up to overlap (not as high as mids)
      // WIDTH: wide players hug their channel to STRETCH the pitch instead of drifting
      // onto the ball; central players shift with it. A coached team keeps its width.
      let tx: number;
      if (p.ax < 28) tx = clamp(p.ax + (ball.x - 50) * 0.1 + rnd(-3, 3), 5, 30); // left channel
      else if (p.ax > 72) tx = clamp(p.ax + (ball.x - 50) * 0.1 + rnd(-3, 3), 70, 95); // right channel
      else tx = clamp(p.ax * 0.5 + ball.x * 0.5 + rnd(-4, 4), 15, 85); // central
      return { tx, ty: clamp(sy, 6, 94) };
    }

    if (presser) return { tx: ball.x + ball.vx * 0.1 + rnd(-2, 2), ty: ball.y + (up ? -2 : 2) };
    // OFF-BALL DEFENDING (A2.4): a coached BLOCK — one coordinated back line that
    // steps as a unit, a compact midfield band ahead of it, and lateral MARKING
    // (each defender shifts toward the nearest attacker's channel) instead of ball-
    // watching. The two pressers still hunt the ball (above), so pressure is intact.
    const marks = outfield(poss).filter((a) => a !== carrier); // attackers to pick up
    const lo = up ? 8 : 50;
    const hi = up ? 50 : 92;
    // conceding a BREAK → the line RECOVERS deeper (sprinting back toward goal, not
    // stepping up). GAME STATE bends it too: a trailing side defends HIGHER (all-in),
    // a leading side drops off and protects the box.
    const uDef = urgency(p.side);
    const depth = (breakT > 0 && breakSide === poss ? 27 : 20) + 6 * Math.max(0, -uDef) - 5 * Math.max(0, uDef);
    const line = clamp(ball.y - dir * depth, lo, hi); // the shared defensive line
    if (p.role === "Defensor") {
      const m = marks.length ? nearest(marks, p.x, p.y) : null;
      const markX = m ? clamp(m.x, 8, 92) : ball.x;
      return { tx: clamp(p.ax * 0.45 + markX * 0.55, 10, 90), ty: line }; // hold the line, mark the width
    }
    const m = marks.length ? nearest(marks, p.x, p.y) : null;
    const band = clamp(line + dir * 15, 6, 94); // compact screen ~15 ahead of the line
    const mx = m ? clamp(p.ax * 0.5 + m.x * 0.3 + ball.x * 0.2, 8, 92) : clamp(p.ax * 0.6 + ball.x * 0.4, 8, 92);
    return { tx: mx, ty: clamp(band * 0.55 + ball.y * 0.45, 6, 94) };
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
    // O(n²) over 22 bodies × 3600 steps, but almost every pair is far apart. Reject on
    // the cheap axis test first: |dx| > SEP ⟹ hypot(dx,dy) ≥ |dx| > SEP (exact for IEEE
    // hypot), so those pairs never pushed anyway. Survivors take the ORIGINAL hypot path
    // verbatim → bit-identical result (determinism preserved), far fewer sqrt calls.
    for (let i = 0; i < all.length; i++) {
      const a = all[i];
      if (sentOff.has(a.id)) continue;
      for (let j = i + 1; j < all.length; j++) {
        const b = all[j];
        if (sentOff.has(b.id)) continue;
        const dx = b.x - a.x;
        if (dx > SEP || dx < -SEP) continue;
        const dy = b.y - a.y;
        if (dy > SEP || dy < -SEP) continue;
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
    // only (re)build the wall on a free kick; the rest of the match it stays empty.
    // Avoids allocating a fresh Map on all ~3600 non-dead-ball steps.
    if (!freeKick) { if (wallPos.size) wallPos = new Map(); return; }
    wallPos = new Map();
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
    stepIndex += 1;
    // scoring drives the clock from the fixed-step counter (headless == live); the
    // cosmetic path keeps taking the caller's external progress unchanged.
    matchProgress = scoring ? clamp(stepIndex / TOTAL_STEPS, 0, 1) : clamp(progress, 0, 1);
    if (captionT > 0) captionT -= dt;
    if (settleT > 0) settleT -= dt;
    if (breakT > 0) { breakT -= dt; if (breakT <= 0) breakSide = null; }
    // ball height: gravity pulls it down, then it settles on the pitch (with a small bounce)
    ball.z += ball.vz * dt;
    ball.vz -= GRAVITY * dt;
    if (ball.z <= 0) { ball.z = 0; ball.vz = ball.vz < -8 ? -ball.vz * 0.3 : 0; }
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
      const attSide: Side = attemptSide; // stable narrowing (branches below null attemptSide)
      const defSide: Side = attSide === "home" ? "away" : "home";
      const blocker = team(defSide).find((d) => dist(d.x, d.y, ball.x, ball.y) < BLOCK_R);
      if (blocker) {
        if (blocker.role === "Goleiro") { goalKick(defSide, "Defesa!"); ticker("Defesa"); }
        else if (R() < 0.22) {
          // the block deflects behind the byline — corner (a real corner source)
          corner(attSide);
        } else {
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
            onTarget[attSide] += 1; // real definition: reached the frame (blocked shots excluded)
            let scored = false;
            if (scoring && attemptShooter) {
              // resolve the on-target chance: xG vs this keeper. save=0.62 is the
              // reference (xG is average-keeper-calibrated); a better/worse GK bends it.
              // NOTE the selection effect the aim spray created: long shots now miss the
              // frame far more, so the ON-TARGET population skews close/central = high
              // xG — the raw xG needs no extra gain to hit real conversion (~2.5 goals).
              const gk = attemptKeeper;
              const save = gk ? clamp(0.5 + (gk.rating - 70) / 90, 0.42, 0.82) : 0.5;
              const pGoal = clamp(attemptXG * ((1 - save) / (1 - 0.62)), 0.02, 0.95);
              if (R() < pGoal) { const sc = attemptShooter; attemptSide = null; goal(attSide, sc); scored = true; }
            }
            if (scored) {
              // goal produced — kickoff already restarted play; nothing more to resolve
            } else if (R() < 0.3) {
              // parried behind for a corner (keepers push firm shots around the post)
              attemptSide = null;
              corner(attSide);
            } else if (R() < 0.55) { goalKick(defSide, "Defesa!"); ticker("Defesa"); }
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
            ticker("Pra fora");
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
        // tired legs read passes worse late (the real late-game defensive fade)
        const intReach = CONTROL * (0.85 + (int.rating - 70) / 110) * (1 - 0.22 * matchProgress);
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
      // fouls come from LEGIT challenges only, so the per-challenge rate carries the
      // whole real-football budget (~15-22 fouls, ~3-4 bookings a match — the
      // calibration harness gates both; the old 1.1 rate only produced ~6 fouls).
      // late-match fatigue: tired defenders mistime challenges — tackles fade, fouls
      // rise (real fouls/cards cluster late; the late-goal surge needs the fade too)
      const foulRate = clamp(2.9 * (carrier.rating / presser.rating), 1.6, 5.0) * (1 + 0.3 * matchProgress);
      const tackleRate = clamp(TACKLE_RATE * (presser.rating / carrier.rating), 1.4, 6) * (1 - 0.34 * matchProgress);
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
          } else if (best.role !== "Goleiro" && dist(best.x, best.y, g.x, g.y) < 18 && R() < 0.65) { lastTouch = best.side; shoot(best); }
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
      // a keeper whose target is far off his line is SWEEPING — that's a sprint
      const sprint = p === carrier || chasing || pressers.includes(p) || ballState === "attempt"
        || (p.role === "Goleiro" && dist(p.x, p.y, p.tx, p.ty) > 7);
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
      ball: { x: ball.x, y: ball.y, z: ball.z },
      poss,
      controlled: ballState === "dribble" || ballState === "pass",
      caption: captionT > 0 ? captionText : null,
      shots: { home: shots.home, away: shots.away },
      goals: { home: goals.home, away: goals.away },
      possHome: totalP ? possFrames.home / totalP : 0.5,
      bookings: { ...bookings },
      sentOff: [...sentOff],
      eventSeq,
      eventText,
    };
  }

  function getResult(): PitchResult {
    return {
      goals: { ...goals },
      events: recorded.map((e) => ({ ...e })),
      stats: { shots: { ...shots }, onTarget: { ...onTarget }, corners: { ...corners }, fouls: { ...foulsBy } },
    };
  }

  return { step, snapshot, scoreFor, getResult };
}
