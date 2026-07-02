// A lightweight rule-based 2D match simulation for the spotlight pitch. With
// {scoring:true} (the v2 path) it is AUTHORITATIVE — goals emerge from resolved
// chances and the headless run IS the result (xG-unification). Without it (the
// frozen v1 path) it stays cosmetic: scoreFor() injects the scoreline.
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
import { laneClearance, onwardValue, pickOverloadFlank, coachAdjust, COACH_ZERO, type CoachAdjust } from "./brain";
import { magnusAccel, spinDecay, curlSign, K_MAGNUS } from "./ball-physics";
import { deriveAttrs, applyTurn, sector8, hash01, shieldFactor, type KinAttrs } from "./kinematics";
import type { Cat } from "./data";
import type { FieldSlot } from "./squad";

export { laneClearance } from "./brain"; // pure geometry lives in brain.ts (re-exported for existing importers)

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
  pens: { home: number; away: number }; // penalties AWARDED TO that side
}
export interface PitchResult {
  goals: { home: number; away: number };
  events: PitchEvent[];
  stats: PitchStats;
}

export type Side = "home" | "away";
export type Card = "yellow" | "red";
export interface Snapshot {
  /** per player: position + quantized 8-way facing (sector8 of the heading) */
  home: { x: number; y: number; f: number }[];
  away: { x: number; y: number; f: number }[];
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
  /** COMMITTED RUN (>0 = running): the player holds one line toward (runX, runY)
   * instead of re-rolling a random drift every retarget — so runs exist to be found. */
  runT: number;
  runX: number;
  runY: number;
  /** Deterministic per-player tendency (0..1, hashed from the id — NOT the match
   * stream): a flair-9 midfielder loves the long shot; a flair-1 one recycles. */
  flair: number;
  /** id-hash kinematic profile: topSpeed/accel/agility/reaction/strength (A2.5) */
  kin: KinAttrs;
  /** facing, radians (atan2) — follows velocity above walking pace, persists at rest */
  heading: number;
  /** reaction lag: remaining seconds of flat-footedness after a change of play */
  lagT: number;
  seenSeq: number;
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
const GRAVITY = 44; // ball-height (z) fall rate — 52 was the 60s-era hang compression; at the 3-min clock deliveries afford real float (+~18% hang, powers trimmed so drops still land in the box)

// hash01 (FNV-1a id → 0..1) now lives in kinematics.ts — one identity primitive
// shared by flair, team style, and the kinematic attribute split.

const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.min(1, t);

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
    pace: (0.85 + ((s.rating ?? 78) - 70) / 60), runT: 0, runX: 0, runY: 0, flair: hash01(s.id),
    kin: deriveAttrs(s.id, s.rating ?? 78), heading: side === "home" ? Math.PI / 2 : -Math.PI / 2, lagT: 0, seenSeq: 0,
  });
  const home = homeSlots.map((s) => mk(s, "home"));
  const away = awaySlots.map((s) => mk(s, "away"));
  const all = [...home, ...away];

  // TEAM IDENTITY: a per-side tactical style derived from the XI (role counts) + a hash
  // of its slot ids — stable across every match and seed (a pure function of the slots,
  // no stream draws), so YOUR team plays like your team all Copa. Ranges are narrow
  // enough that quality still decides (the 88v60 calibration gate stands watch).
  const styleOf = (slots: FieldSlot[]) => {
    const h = hash01(slots.map((x) => x.id).join("|"));
    const h2 = hash01(slots.map((x) => x.id).join("&") + "t");
    const defC = slots.filter((x) => x.role === "Defensor").length;
    const atkC = slots.filter((x) => x.role === "Atacante").length;
    return {
      lineDepth: 20 + (defC >= 5 ? 2.5 : 0) - (atkC >= 3 ? 1.5 : 0) + (h - 0.5) * 6, // deep block ↔ high line
      pressDist: 4.5 + (atkC >= 3 ? 0.6 : 0) - (defC >= 5 ? 0.4 : 0) + (h2 - 0.5) * 1.6, // press trigger radius
      directness: 0.85 + h2 * 0.4, // vertical ↔ patient (multiplies forward-pass value)
      longBall: 0.28 + h * 0.24, // GK distribution: build short ↔ launch it
      tempo: 0.88 + h2 * 0.24, // divides the on-ball decision cadence
    };
  };
  const style = { home: styleOf(homeSlots), away: styleOf(awaySlots) };
  const ball = { x: 50, y: 50, vx: 0, vy: 0, z: 0, vz: 0, spin: 0 }; // z = height; spin curls flight (Magnus)
  const shots = { home: 0, away: 0 };
  const onTarget = { home: 0, away: 0 };
  const corners = { home: 0, away: 0 };
  const foulsBy = { home: 0, away: 0 };
  const pens = { home: 0, away: 0 };
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
  let penaltyFor: Side | null = null; // a spot kick is being taken (ceremony → strike)
  let penaltyShot = false; // the in-flight attempt is the penalty (no body blocks)
  let resetT = 0; // post-goal moment: the ball is dead, both teams walk back to shape
  let kickoffPending: Side | null = null; // who restarts once the moment passes
  let presserA: P | null = null; // the PERSISTENT pressing pair (hysteresis — no per-tick churn)
  let presserB: P | null = null;
  // TEAM INTENTION: a persistent work-it-wide plan — the side commits to overloading
  // one flank for a few seconds (pass bias + wide runs + the cross it was built for)
  // instead of re-deciding from scratch every touch. Dies on turnover.
  const plan = {
    home: { flank: null as "L" | "R" | null, t: 0 },
    away: { flank: null as "L" | "R" | null, t: 0 },
  };
  // COACH BRAIN: structural style-pack deltas recomputed at halftime/60'/75' and
  // after every goal — the deterministic "coach" the per-play urgency sits on top of.
  const coach: Record<Side, CoachAdjust> = { home: COACH_ZERO, away: COACH_ZERO };
  let coachBucket = 0;
  let scoreSide: Side | null = null;
  let attemptSide: Side | null = null;
  let attemptOnTarget = false;
  let restartFor: Side | null = null;
  let lastTouch: Side = poss;
  let pendingCross = false;
  let loftedPass = false; // a punted/switched ball — its DROP is a header contest
  let forceCross = false;
  let cornerDelivery = false;
  let freeKick = false;
  let matchProgress = 0;
  let stepIndex = 0; // fixed-step counter — the authoritative clock when scoring
  let phaseSeq = 0; // increments on every change of play — reaction lag keys off it
  let lastPhaseKey = "";
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
  // real matches OPEN CAGEY — the 1-15' goal bucket is the lowest of the match. Risk
  // appetite ramps from ~0.6 at kickoff to 1.0 by half-time.
  const settled = () => 0.62 + 0.38 * Math.min(1, matchProgress / 0.5);

  // the coach's read for one side (pure mapping in brain.ts; triggers live in
  // step()/goal()). A ticker line makes a real shift visible in the event feed.
  const recoach = (announce: boolean) => {
    for (const s of ["home", "away"] as const) {
      const o: Side = s === "home" ? "away" : "home";
      const next = coachAdjust(goals[s] - goals[o], shots[s], shots[o], matchProgress);
      if (announce && next.lineDelta > coach[s].lineDelta + 1) ticker("Pressão alta");
      else if (announce && next.lineDelta < coach[s].lineDelta - 1) ticker("Bloco recuado");
      coach[s] = next;
    }
  };

  const urgency = (s: Side) => {
    const diff = s === "home" ? goals.away - goals.home : goals.home - goals.away;
    const ramp = clamp((matchProgress - 0.55) / 0.35, 0, 1);
    // LEVEL late is risk-on for BOTH teams (everyone wants the winner) — draws are
    // ~27% of matches and without this they'd contribute no late surge at all.
    // NB on the cosmetic v1 route goals stay 0-0, so its pitch always plays the mild
    // level-late profile — the most neutral assumption for a sim that can't see the
    // real scoreline (intended; the strong chase/protect modes stay scoring-only).
    // NB the cosmetic path stays 0-0 with matchProgress from the caller, so the mild
    // draw-urgency also animates v1's late play — behavior, not scoreline (inert there).
    if (diff === 0) return 0.45 * ramp;
    return clamp(diff, -1, 1) * ramp;
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
    if (liveSteal) { breakT = 3.5 * settled(); breakSide = p.side; } // early breaks are less committed (compact, cautious)
    else if (breakSide !== null && p.side !== breakSide) { breakT = 0; breakSide = null; } // changed hands — break over
    if (p.side !== poss) { const lost = plan[poss]; lost.flank = null; lost.t = 0; } // the plan dies with the possession
    carrier = p;
    poss = p.side;
    lastTouch = p.side;
    ballState = "dribble";
    passTo = null;
    restartFor = null;
    attemptSide = null;
    pendingCross = false;
    loftedPass = false;
    forceCross = false;
    cornerDelivery = false;
    offsidePending = false;
    ball.vx *= 0.15;
    ball.vy *= 0.15;
    ball.z = 0; ball.vz = 0; ball.spin = 0; // controlled → at the player's feet, spin killed
    // cadence: ~0.45s per on-ball decision — at the 3-min clock that's ~100+ on-ball
    // decisions a match (close to real possession counts; the 60s clock managed ~33)
    decideT = liveSteal ? rnd(0.15, 0.4) : rnd(0.3, 0.65); // a stolen ball launches at once
    settleT = 0.35; // protect the new carrier from an instant re-tackle
  }

  /** FIRST TOUCH (physics): a live reception is a TOUCH, not a teleport-to-feet.
   * Touch error grows with incoming ball speed and pressure and shrinks with skill;
   * a bad touch pushes the ball loose a few units — a live 50/50 and the honest
   * turnover engine (why great players look calm under pressure). Restarts and
   * keeper hands are exempt; tackles/knock-downs keep their own chaos machinery. */
  function receive(p: P) {
    const inSpeed = ballSpeed();
    const rivals = opp(p.side).filter(canContest);
    const pd = rivals.length ? nearest(rivals, p.x, p.y) : null;
    const pressure = pd ? clamp(1 - dist(pd.x, pd.y, p.x, p.y) / 6, 0, 1) : 0;
    const skill = clamp((p.rating - 55) / 45, 0.3, 1);
    const err = (inSpeed / 85) * (0.45 + 0.75 * pressure) * (1.3 - skill);
    // NB no late-fatigue multiplier here: bad touches ABORT attacking moves, so
    // scaling them with progress suppressed the late-goal surge (measured -1pp on
    // the late share). Fatigue already lives in stray passes / tackle fade.
    const pBad = clamp(err - 0.16, 0, 0.45);
    if (R() < pBad) {
      const ang = rnd(0, Math.PI * 2);
      const push = (2.5 + 7 * clamp(err, 0, 1.2)) * BALL_FRICTION; // v0 so the roll covers ~2.5-9.5 units
      ball.vx = p.vx * 0.35 + Math.cos(ang) * push;
      ball.vy = p.vy * 0.35 + Math.sin(ang) * push;
      ball.z = 0; ball.vz = 0; ball.spin = 0;
      ballState = "loose";
      passTo = null;
      carrier = null;
      lastTouch = p.side;
      pendingCross = false;
      loftedPass = false;
      caption("Dominou mal!");
      return;
    }
    giveBallTo(p);
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
    decideT = rnd(0.5, 0.9);
    caption("Impedimento!");
    breakT = 0; breakSide = null; penaltyShot = false; loftedPass = false; // dead ball — any break is over
    ticker("Impedimento");
  }

  function kickoff(toSide: Side) {
    breakT = 0; breakSide = null; penaltyShot = false; loftedPass = false; // dead ball — any break is over
    ball.x = 50; ball.y = 50; ball.vx = 0; ball.vy = 0;
    giveBallTo(nearest(team(toSide), 50, 50));
  }

  function throwIn(x: number, side: Side) {
    ball.x = clamp(x, 1, 99);
    ball.y = clamp(ball.y, 3, 97);
    ball.vx = 0; ball.vy = 0; ball.spin = 0;
    ballState = "loose";
    restartFor = side;
    caption("Lateral");
    breakT = 0; breakSide = null; penaltyShot = false; loftedPass = false; // dead ball — any break is over
  }

  function goalKick(side: Side, cap: string) {
    const g = OWN[side];
    ball.x = clamp(g.x + rnd(-10, 10), 6, 94);
    ball.y = side === "home" ? 11 : 89;
    ball.vx = 0; ball.vy = 0;
    giveBallTo(keeper(side));
    caption(cap);
    breakT = 0; breakSide = null; penaltyShot = false; loftedPass = false; // dead ball — any break is over
  }

  function corner(attSide: Side) {
    corners[attSide] += 1;
    ball.x = ball.x < 50 ? 2 : 98;
    ball.y = attSide === "home" ? 98 : 2;
    ball.vx = 0; ball.vy = 0;
    giveBallTo(nearest(outfield(attSide), ball.x, ball.y));
    forceCross = true;
    cornerDelivery = true;
    decideT = rnd(1.0, 1.6); // players crowd the box — a real corner ceremony at the 3-min clock
    caption("Escanteio!");
    breakT = 0; breakSide = null; penaltyShot = false; loftedPass = false; // dead ball — any break is over
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
    // MIS-HIT: a strike under a body (presser within 3.5 — no time to set) gets
    // SCUFFED at a rating-scaled rate: half power, doubled spray, rarely troubling
    // the keeper. Penalties are naturally exempt — the ceremony clears the space.
    const oppOut2 = opp(p.side).filter((o) => o.role !== "Goleiro");
    const pd2 = oppOut2.length ? nearest(oppOut2, p.x, p.y) : null;
    const pressured = !header && pd2 !== null && dist(pd2.x, pd2.y, p.x, p.y) < 3.5;
    const scuff = pressured && R() < clamp(0.32 - (p.rating - 60) / 140, 0.08, 0.32);
    const sprayF = scuff ? 2.1 : 1;
    // Aim error wide enough that MISSES genuinely happen (real football: only ~a third
    // of shots hit the frame). Range and poor finishing widen the spray; the calibration
    // harness gates the on-target fraction. Misses go out for goal kicks; deflected/
    // parried attempts go behind for corners — the whole byline ecosystem needs these.
    const aimX = clamp(g.x + (1 - acc) * rnd(-16, 16) * sprayF + rnd(-6, 6) * sprayF + dg * 0.14 * rnd(-1, 1), 20, 80);
    attemptOnTarget = Math.abs(aimX - g.x) < 8;
    attemptSide = p.side;
    if (scoring) {
      // xG for THIS strike — angle (central > wide), distance, finishing. Pure
      // arithmetic (no R() draws beyond the strike rolls above) — resolved into
      // a goal/save when the shot reaches the line.
      const shotAngle = 1 - Math.abs(ball.x - 50) / 50; // 1 central, 0 by the touchline
      const distF = clamp(1 - (dg - 6) / 34, 0.05, 1); // 1 in the six-yard box → ~0 at range
      const finish = clamp((p.rating - 55) / 45, 0.25, 1) * (header ? 0.72 : 1);
      attemptXG = clamp(0.09 + 0.62 * distF * (0.45 + 0.55 * shotAngle) * (0.55 + 0.45 * finish), 0.02, 0.83);
      if (scuff) attemptXG *= 0.45; // a mis-hit rarely beats anyone
      attemptShooter = p;
      attemptKeeper = keeper(p.side === "home" ? "away" : "home");
    }
    // FINESSE BEND: a set strike from range, flair-gated — deliberate curl toward a
    // corner. The strike aims WIDE by the analytic Magnus deflection and bends back
    // into aimX, so attemptOnTarget (computed from aimX above) stays truthful.
    const power = (header ? 100 : 128) * (scuff ? rnd(0.5, 0.72) : 1);
    let strikeX = aimX;
    let spin = 0;
    if (!header && !scuff && dg > 12 && dg < 30 && R() < (0.2 + 0.5 * p.flair) * acc) {
      const mag = rnd(0.3, 0.55);
      const sgn = R() < 0.5 ? 1 : -1; // curl left/right of travel
      spin = sgn * mag;
      const def = (0.5 * K_MAGNUS * mag * dg * dg) / power; // lateral drift over the flight
      strikeX = clamp(aimX - (p.side === "home" ? -1 : 1) * sgn * def, 12, 88);
    }
    const d = Math.max(1, dist(ball.x, ball.y, strikeX, g.y));
    ball.vx = ((strikeX - ball.x) / d) * power;
    ball.vy = ((g.y - ball.y) / d) * power;
    ball.spin = spin;
    ballState = "attempt";
    carrier = null;
    passTo = null;
    pendingCross = false;
    caption(scuff ? "Mascou!" : header ? "Cabeça!" : "Chute!");
    ticker(scuff ? "Chute mascado" : header ? "Cabeçada" : "Chute");
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
    recoach(false); // the coach reacts to the scoreline (silently — the goal owns the feed)
    // the MOMENT: ball dead in the net, both teams walk back to shape, THEN the
    // conceding side restarts — kickoff no longer fires mid-goalmouth-stampede
    ball.vx = 0; ball.vy = 0; ball.z = 0; ball.vz = 0; ball.spin = 0;
    carrier = null;
    passTo = null;
    ballState = "loose";
    resetT = 2.2; // the celebration breathes at the 3-min clock
    kickoffPending = side === "home" ? "away" : "home";
  }

  function foul(victim: P, fouler: P) {
    foulsBy[fouler.side] += 1;
    // a foul INSIDE the box the victim attacks = PENALTY, not a walled free kick.
    // Scoring path only: with scoring off a pen could never convert (goals don't exist
    // there), so the cosmetic v1 route keeps its plain free kick.
    const inBox = scoring && Math.abs(victim.x - 50) < 22 && (victim.side === "home" ? victim.y > 84 : victim.y < 16);
    if (inBox) { penalty(victim.side, fouler); return; }
    ball.x = victim.x; ball.y = victim.y; ball.vx = 0; ball.vy = 0;
    giveBallTo(nearest(team(victim.side), ball.x, ball.y));
    freeKick = true;
    decideT = rnd(0.7, 1.2); // dead ball — the wall forms, the taker settles
    caption("Falta!");
    breakT = 0; breakSide = null; penaltyShot = false; loftedPass = false; // dead ball — any break is over
    ticker("Falta");
    // ~18% of fouls booked (2% straight red) → real ~3.5-4 yellows + ~0.2 reds at the
    // 180s foul volume (~22/match). Fouls concentrate on the pressers, so an ALREADY-
    // BOOKED fouler is carded again at a sharply reduced rate — the ref's second-yellow
    // reluctance + the player easing off; without it second yellows stack into 3-4×
    // the real red rate.
    if (R() < (bookings[fouler.id] ? 0.035 : 0.18)) card(fouler, R() < 0.02 ? "red" : "yellow");
  }

  /** Spot kick: the fouled side's best finisher against the keeper — the ceremony is a
   * long dead-ball pause (no wall, no tackling), then a near-unstoppable-by-bodies
   * attempt resolved purely by aim + the keeper (real pens: ~76% scored). */
  function penalty(attSide: Side, fouler: P) {
    pens[attSide] += 1;
    const spotY = attSide === "home" ? 88 : 12;
    ball.x = 50; ball.y = spotY; ball.vx = 0; ball.vy = 0; ball.z = 0; ball.vz = 0;
    const taker = outfield(attSide).reduce((b, m) => (m.rating > b.rating ? m : b), outfield(attSide)[0]);
    giveBallTo(taker);
    penaltyFor = attSide;
    breakT = 0; breakSide = null; // a spot kick is a dead ball — any break is over
    freeKick = false; // no wall on a penalty
    decideT = rnd(2.2, 2.8); // the ceremony — spot placed, keeper set, crowd holds its breath
    settleT = 3.0; // nobody may challenge the taker
    caption("Pênalti!");
    ticker("Pênalti");
    if (R() < 0.35) card(fouler, R() < 0.06 ? "red" : "yellow"); // box fouls get booked more
  }

  function doCross(p: P) {
    const isCorner = cornerDelivery;
    forceCross = false;
    cornerDelivery = false;
    const home2 = p.side === "home";
    const boxY = isCorner ? (home2 ? 91 : 9) : home2 ? 86 : 14; // corners whip into the goalmouth
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
    const power = clamp(38 + d * 1.0, 42, 86); // trimmed with the longer hang so drops still land in the box
    ball.vx = ((bx - ball.x) / d) * power;
    ball.vy = ((boxY - ball.y) / d) * power;
    ball.z = 0;
    ball.vz = isCorner ? rnd(16, 21) : rnd(13, 18); // loft it into the box — a real floated delivery
    // MAGNUS: the delivery is WHIPPED — corners pick in/outswing (65% in), open-play
    // crosses bend toward the goalmouth. curlSign aims the curl at the goal centre.
    const g0 = ATTACK[p.side];
    const sgn = curlSign(ball.vx, ball.vy, g0.x - ball.x, g0.y - ball.y);
    ball.spin = isCorner
      ? (R() < 0.65 ? sgn * rnd(0.55, 0.85) : -sgn * rnd(0.35, 0.55))
      : sgn * rnd(0.3, 0.55);
    ballState = "pass";
    passTo = tgt;
    // the target ATTACKS the delivery — a committed dart to the drop point, so the
    // aerial duel is a real contest instead of a defender strolling under it
    tgt.runT = Math.max(tgt.runT, 0.9);
    tgt.runX = clamp(bx, 6, 94);
    tgt.runY = clamp(boxY, 6, 94);
    pendingCross = true;
    lastTouch = p.side;
    caption(isCorner ? "Na área!" : "Cruzamento!");
  }

  function distribute(gk: P) {
    const dir = gk.side === "home" ? 1 : -1;
    const mates = outfield(gk.side);
    if (!mates.length) { decideT = rnd(0.4, 0.8); return; }
    const long = R() < (urgency(gk.side) > 0.3 ? 0.65 : style[gk.side].longBall); // team identity: build short ↔ launch; chasing late → hurry it long
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
    ball.vz = long ? rnd(18, 24) : 0; // a long clearance is lofted (real punt hang); a short throw stays low
    ball.spin = long ? rnd(-0.15, 0.15) : 0;
    loftedPass = long; // the punt's landing is a header duel, like real goal kicks
    if (long) {
      // the target ATTACKS the punt's landing area — otherwise the drop is uncontested
      // and the ball bounces in limbo (nobody may touch an airborne ball)
      tgt.runT = Math.max(tgt.runT, 1.2);
      tgt.runX = clamp(lx, 6, 94);
      tgt.runY = clamp(tgt.y, 6, 94);
    }
    ballState = "pass";
    passTo = tgt;
    lastTouch = gk.side;
    if (long) { caption("Lançamento!"); ticker("Lançamento"); }
  }

  function decide() {
    if (!carrier) return;
    if (penaltyFor === carrier.side) {
      // the STRIKE: shoot() from the spot (12 out, central → its aim spray is naturally
      // tight and its on-target check applies — pens CAN be blazed wide); forced high
      // xG so only the keeper roll stands between spot and net. Real pens ≈ 76% scored.
      penaltyFor = null;
      shoot(carrier);
      penaltyShot = true;
      if (scoring) attemptXG = 0.78; // spot-kick conversion reference (pGoal bends it by keeper)
      return;
    }
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
    // Re-anchored at 180s: the original test (dg<36, goalside |Δx|<12) fired from
    // wide/far positions ~18×/match — over HALF of all shots — because the longer
    // clock reaches "no defender in the window" spots constantly. A genuine
    // breakaway is CLOSE, reasonably CENTRAL, and has a CLEAR shot lane.
    const oppOutfield = defenders.filter((d) => d.role !== "Goleiro");
    const goalsideDefs = oppOutfield.filter(
      (d) => (dir > 0 ? d.y > carrier!.y + 1 : d.y < carrier!.y - 1) && Math.abs(d.x - carrier!.x) < 14,
    );
    const clearOnGoal = dg < 26 && Math.abs(carrier.x - 50) < 18 && goalsideDefs.length === 0
      && laneClearance(carrier.x, carrier.y, ATTACK[side].x, ATTACK[side].y, oppOutfield) > 6.5;
    if (clearOnGoal) { shoot(carrier); return; }

    // ── UTILITY AI: score every option, then pick (a better player picks the best
    // more reliably). Passes are penalized by INTERCEPT RISK — the clearance of the
    // pass lane — so they stop firing blind; shooting is an xG estimate (distance ×
    // angle × how clear the shot lane is); dribbling holds the ball into space.
    const mates = outfield(side).filter((p) => p !== carrier);
    const oppOut = oppOutfield;
    const opps = oppOut.length ? oppOut : defenders;
    const defSideName: Side = side === "home" ? "away" : "home";
    const pd = nearest(defenders, carrier.x, carrier.y);
    const pressed = dist(pd.x, pd.y, carrier.x, carrier.y) < style[defSideName].pressDist + coach[defSideName].pressDelta;
    const breaking = breakT > 0 && breakSide === side;
    // the coach's directness delta lays over team identity for every forward choice
    const direct = style[side].directness + coach[side].directDelta;

    // TEAM INTENTION: central congestion in the attacking half → commit to
    // OVERLOADING the emptier flank for a spell (the plan the passes/runs/cross
    // below all read). One decision, several seconds of coordinated behavior.
    const car = carrier;
    const crowd = opps.filter((d) => dist(d.x, d.y, car.x, car.y) < 14).length;
    const inAttackHalf = dir > 0 ? carrier.y > 55 : carrier.y < 45;
    if (!plan[side].flank && inAttackHalf && crowd >= 2 && !breaking && matchProgress > 0.15) {
      plan[side].flank = pickOverloadFlank(oppOut); // overloads come after the opening feeling-out
      plan[side].t = rnd(6, 9);
    }
    const flank = plan[side].flank;

    type Opt = { kind: "shoot" | "cross" | "pass" | "switch" | "dribble"; target?: P; score: number };
    const opts: Opt[] = [];

    // SHOOT — an xG-ish estimate. Appetite re-anchored for the 180s clock: the 60s
    // match was SUPPLY-starved (~7 shots/team) and needed a cranked 3.0 gain; at 180s
    // build-ups actually complete, so the same appetite overshot to ~17.6/team and
    // the gain came DOWN to land on the real ~12. Speculative efforts still miss
    // (the aim spray), so volume doesn't inflate goals.
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
    // ROLE + FLAIR: a striker backs himself, a centre-back recycles; the speculative
    // long-range appetite is a PERSONAL tendency (id-hashed) — the flair player leathers
    // it from 28 yards, his teammate never does
    const roleF = carrier.role === "Atacante" ? 1.15 : carrier.role === "Defensor" ? 0.55 : 1;
    const spec = (dg < 30 ? 0.08 : 0) * (0.55 + 0.9 * carrier.flair);
    opts.push({ kind: "shoot", score: (xg * 1.9 * roleF + spec) * settled() * (1 + 0.5 * Math.max(0, u)) });

    // CROSS from wide + advanced — a REAL team's most frequent delivery (15-20/match):
    // the duel decides the header, defenders clear most, corners + second balls fall out
    if ((carrier.x < 30 || carrier.x > 70) && dg < 44) {
      const boxMates = mates.filter((m) => (dir > 0 ? m.y > 74 : m.y < 26)).length;
      // the overload plan CULMINATES here: reaching the committed flank makes the
      // cross the intended payoff, not just another option
      const planned = flank && (flank === "L" ? carrier.x < 30 : carrier.x > 70) ? 0.25 : 0;
      opts.push({ kind: "cross", score: 0.5 + boxMates * 0.2 + planned });
    }

    // PASS to each mate — progress × openness × lane-safety × sensible range,
    // then LOOKAHEAD: the receiver's own best next action (shoot, or an open man
    // further on — onwardValue self-excludes the receiver) multiplies in, so the
    // carrier plays the pass BEFORE the pass. On the BREAK, forward progress is
    // worth more; a mate on the plan's flank carries the overload bias.
    for (const m of mates) {
      const ahead = dir > 0 ? m.y - carrier.y : carrier.y - m.y;
      const nd = nearest(opps, m.x, m.y);
      const openness = clamp(dist(nd.x, nd.y, m.x, m.y) / 12, 0.05, 1);
      const lane = clamp(laneClearance(ball.x, ball.y, m.x, m.y, oppOut) / 5, 0, 1);
      const range = dist(carrier.x, carrier.y, m.x, m.y);
      // a leader protecting the scoreline keeps it SHORT and safe (recenter ~15);
      // otherwise the preferred pass length is team identity + the coach's read
      const rangeF = clamp(1 - Math.abs(range - (u < -0.3 ? 15 : 12 + 9 * direct)) / 46, 0.25, 1);
      const progF = clamp(0.5 + ahead / 38, 0.05, 1.25) * (breaking && ahead > 0 ? 1.35 : 1) * (ahead > 0 ? direct : 1);
      // a mate ON A RUN is the ball a real carrier looks for first
      const runBoost = m.runT > 0 && ahead > 4 ? 1.35 : 1;
      // lookahead sharpens WITH the match (settled): combinations open up as teams
      // stop feeling each other out — full incisiveness from kickoff front-loaded
      // the goal-timing curve (40% of goals before 30')
      const onward = onwardValue(m.x, m.y, goal, mates, oppOut) * settled();
      const planBoost = flank && (flank === "L" ? m.x < 40 : m.x > 60) ? 1.3 : 1;
      opts.push({ kind: "pass", target: m, score: progF * (0.4 + 0.6 * openness) * (0.3 + 0.7 * lane) * rangeF * runBoost * (0.7 + 0.5 * onward) * planBoost });
    }

    // SWITCH the play: the big lofted diagonal to the far flank — it FLIES over the
    // congestion (the z-gate makes that literally true), the patient team's escape from
    // a crowded side. Scored by how OPEN the far man is; only sensible when this flank
    // is actually crowded (2+ opponents within 14).
    if (!pressed || carrier.rating > 74) {
      let sw: P | null = null;
      let swOpen = 0;
      for (const m of mates) {
        if (Math.abs(m.x - carrier.x) < 36) continue;
        const nd = nearest(opps, m.x, m.y);
        const o = clamp(dist(nd.x, nd.y, m.x, m.y) / 12, 0, 1);
        if (o > swOpen) { swOpen = o; sw = m; }
      }
      if (sw && swOpen > 0.62 && crowd >= 2) opts.push({ kind: "switch", target: sw, score: 0.18 + 0.28 * swOpen });
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
    if (chosen.kind === "switch" && chosen.target) {
      const tg2 = chosen.target;
      const lx2 = clamp(tg2.x + rnd(-4, 4), 4, 96);
      const ly2 = clamp(tg2.y + rnd(-4, 4), 4, 96);
      const d2 = Math.max(1, dist(ball.x, ball.y, lx2, ly2));
      const pw = clamp(32 + d2 * 1.05, 48, 100);
      ball.vx = ((lx2 - ball.x) / d2) * pw;
      ball.vy = ((ly2 - ball.y) / d2) * pw;
      ball.z = 0.2;
      ball.vz = rnd(15, 20); // high over everything — a real diagonal hangs
      ball.spin = rnd(-0.25, 0.25); // a touch of fade either way
      loftedPass = true; // its landing is contested in the air
      tg2.runT = Math.max(tg2.runT, 1.1); // the open man ATTACKS the landing spot
      tg2.runX = lx2;
      tg2.runY = ly2;
      ballState = "pass";
      passTo = tg2;
      carrier = null;
      lastTouch = side;
      caption("Inversão!");
      ticker("Inversão de jogo");
      return;
    }
    // a leader on the ball late slows the game down (time management on the dribble)
    if (chosen.kind === "dribble" || !chosen.target) { decideT = rnd(0.25, 0.55) * (u < -0.3 ? 1.35 : 1) / (style[side].tempo + coach[side].tempoDelta); return; }

    // PASS — accuracy + stray + through-ball lead + offside
    const tg = chosen.target;
    const aheadTg = dir > 0 ? tg.y - carrier.y : carrier.y - tg.y;
    // slipped ahead of a run — likelier on the break / when chasing. The base rate
    // ramps with settled(): early through-balls fed the breakaway pipeline that
    // front-loaded the goal-timing curve at 180s (the killers come out as the game
    // stretches; real openings are cagey)
    const through = aheadTg > 8 && R() < (breaking ? 0.7 : u > 0.3 ? 0.65 : 0.5 * settled());
    // ONE-TWO: a short pass under pressure and the passer BURSTS beyond his marker for
    // the return — the give-and-go. His dart is a committed run, so the receiver's own
    // pass-to-the-run logic finds him back; the whole combination emerges from the two
    // mechanics without any scripted sequence.
    const shortFwd = dist(carrier.x, carrier.y, tg.x, tg.y) < 15 && aheadTg > -2;
    if (shortFwd && pressed && carrier.runT <= 0 && R() < clamp(0.22 + (carrier.rating - 60) / 110, 0.12, 0.5)) {
      carrier.runT = rnd(1.1, 1.7);
      carrier.runX = clamp(tg.x + rnd(-7, 7), 10, 90);
      carrier.runY = clamp(tg.y + dir * rnd(8, 15), 6, 94); // beyond the wall player
    }
    // fatigue hits the MIND too: stray passes rise late — live turnovers that launch
    // counter-attacks, the engine of the real late-goal surge
    const strayChance = clamp(0.24 - (carrier.rating - 70) / 120, 0.03, 0.3) * (1 + 0.75 * matchProgress);
    const acc = clamp((carrier.rating - 55) / 45, 0.3, 1);
    const stray = R() < strayChance;
    // aim where a committed runner is GOING (his run spot), not where he is
    const toRun = tg.runT > 0.4;
    let lx = toRun ? tg.runX + rnd(-2, 2) : tg.x + tg.vx * 0.16;
    let ly = toRun ? tg.runY + dir * rnd(0, 5) : tg.y + tg.vy * 0.16 + (through ? dir * rnd(8, 20) : 0);
    const d0 = Math.max(1, dist(ball.x, ball.y, lx, ly));
    const ux = (lx - ball.x) / d0;
    const uy = (ly - ball.y) / d0;
    const err = (1 - acc) * rnd(-7, 7) + (stray ? rnd(-15, 15) : 0);
    lx += -uy * err;
    ly += ux * err;
    const d = Math.max(1, dist(ball.x, ball.y, lx, ly));
    let power = clamp(24 + d * 1.25, 38, 108);
    // DRIVEN vs FLOATED: a long ball through a TIGHT lane gets clipped over the
    // traffic instead of drilled through it (through-balls stay on the deck — that
    // is their nature). A floated long ball drops into a contest like a punt.
    if (d > 22 && !through) {
      const tight = laneClearance(ball.x, ball.y, lx, ly, opp(side).filter((o) => o.role !== "Goleiro")) < 4;
      if (tight || R() < 0.2) {
        ball.vz = clamp(rnd(9, 13) * (d / 34), 7, 16);
        loftedPass = d > 30; // a long float's drop is a header contest
        power *= 0.9;
      }
    }
    ball.vx = ((lx - ball.x) / d) * power;
    ball.vy = ((ly - ball.y) / d) * power;
    ballState = stray ? "loose" : "pass";
    passTo = stray ? null : tg;
    offsidePending = !stray && (offsideAt(tg, side) || (through && R() < 0.15));
    if (offsidePending) offsideT = 0.35;
  }

  function integrateBall(dt: number, friction: number) {
    // MAGNUS: spin bends the flight perpendicular to travel (inswinging corners,
    // whipped crosses, fading switches). Decays in flight; zeroed on control.
    if (ball.spin !== 0) {
      const m = magnusAccel(ball.vx, ball.vy, ball.spin);
      ball.vx += m.ax * dt;
      ball.vy += m.ay * dt;
      ball.spin = spinDecay(ball.spin, dt);
    }
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

    // DEAD BALL: the taker WALKS TO the placed ball (spot/flag/free kick) — he does
    // not dribble off with it (the ball is pinned in step() until the restart fires)
    if (p === carrier && decideT > 0 && (penaltyFor !== null || freeKick || cornerDelivery)) {
      return { tx: ball.x, ty: ball.y };
    }

    // penalty ceremony: everyone except the taker and the keepers HOLDS at the edge of
    // the box (the referee's arc) until the kick is away (keepers returned above)
    if (penaltyFor && p !== carrier) {
      const edgeY = penaltyFor === "home" ? 78 : 22;
      return { tx: clamp(26 + (p.ax / 100) * 48, 26, 74), ty: edgeY + rnd(-2, 2) };
    }

    // corner: attackers crowd the SIX-YARD BOX among the defenders (real corner crowds
    // mix at the goalmouth — an edge-of-box crowd loses every drop to the goal-side
    // defenders), defenders hold the goal area
    if (cornerDelivery) {
      const attackY = up ? 90 : 10;
      if (p.side === poss && p.role !== "Defensor") return { tx: clamp(30 + (p.ax) * 0.4 + rnd(-4, 4), 30, 70), ty: attackY + rnd(-3, 3) };
      // defenders drop to their OWN goal end (up = home = defends y=0). This ternary
      // was inverted for ~2 days and sent the whole defence to the WRONG END of the
      // pitch on every corner — caught by the adversarial review's empirical probe.
      if (p.side !== poss) return { tx: clamp(34 + p.ax * 0.3, 30, 70), ty: (up ? 8 : 92) + rnd(-4, 4) };
    }

    if (p.side === poss) {
      if (p === carrier) {
        const g = ATTACK[p.side];
        return { tx: clamp(ball.x + (g.x - ball.x) * 0.08 + rnd(-4, 4), 8, 92), ty: clamp(ball.y + dir * rnd(5, 10), 6, 94) };
      }
      // an ACTIVE COMMITTED RUN overrides everything: hold the line to the spot
      if (p.runT > 0) return { tx: p.runX, ty: p.runY };
      // deeper gambles on the break (defence out of shape) AND when chasing late (risk-on)
      const pushOn = (breakT > 0 && breakSide === p.side) || urgency(p.side) > 0.3;
      // START a run: an attacker (or an advanced mid) darts for the space BEHIND the
      // second-to-last defender — one committed line for ~2s that a through-ball can
      // actually find (better players make more runs). This is what "movement" is.
      const runner = p.role === "Atacante" || (p.role === "Meio-campo" && (dir > 0 ? p.y > 45 : p.y < 55));
      // the overload plan asks ITS flank's wide men for the extra darts
      const planF = plan[p.side].flank;
      const onPlanFlank = planF && (planF === "L" ? p.ax < 28 : p.ax > 72) ? 1.5 : 1;
      if (runner && R() < ((p.role === "Atacante" ? 0.3 : 0.16) + (p.rating - 70) / 150) * settled() * (1 + 0.8 * Math.max(0, urgency(p.side))) * onPlanFlank) {
        const ys = opp(p.side).map((o) => o.y).sort((a, b) => (dir > 0 ? b - a : a - b));
        const defLine = ys[1] ?? ys[0] ?? (dir > 0 ? 92 : 8); // second-to-last defender
        const gap = dir > 0 ? defLine - p.y : p.y - defLine;
        if (gap > 2 && gap < 45) {
          p.runT = rnd(1.4, 2.4);
          p.runX = clamp(p.x + rnd(-8, 8), 10, 90);
          p.runY = clamp(defLine + dir * rnd(2, 7), 6, 94); // onto (just past) the shoulder
          return { tx: p.runX, ty: p.runY };
        }
      }
      let sy: number;
      if (p.role === "Atacante") sy = ball.y + dir * (pushOn ? rnd(14, 40) : rnd(8, 30));
      else if (p.role === "Meio-campo") sy = ball.y + dir * (pushOn ? rnd(2, 18) : rnd(-4, 12));
      else sy = ball.y + dir * (urgency(p.side) > 0.3 ? rnd(-6, 6) : rnd(-14, -6)); // fullbacks overlap; thrown FORWARD when chasing
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
    // tired legs can't hold a high line — the whole block SAGS as the match ages
    // (real late-game lines sink), gifting closer shooting positions late
    const depth = (breakT > 0 && breakSide === poss ? 27 : style[p.side].lineDepth + coach[p.side].lineDelta) + 7 * matchProgress + 6 * Math.max(0, -uDef) - 5 * Math.max(0, uDef);
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
    // a COMMITTED RUN digs deep: strikers save their legs for the darts, so an active
    // run only pays 45% of the fatigue penalty — the tracking defenders pay it in full,
    // or the late game loses exactly the runs its urgency asks for
    const fat = matchProgress * clamp(0.3 - (p.rating - 70) / 220, 0.14, 0.32);
    const stam = 1 - (p.runT > 0 ? 0.45 * fat : fat);
    const maxS = (sprint ? SPRINT : JOG) * p.pace * p.kin.topSpeedF * stam;
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
    const amax = ACCEL * p.kin.accelF * dt;
    if (am > amax) { ax = (ax / am) * amax; ay = (ay / am) * amax; }
    // A2.5 KINEMATICS: the accel-clamped update passes through TURN physics — at
    // speed the heading arcs at the player's agility instead of snapping (fast =
    // wide arcs; a reversal plants and cuts). Ends the hockey-air-bot feel.
    const t = applyTurn(p.vx, p.vy, p.vx + ax, p.vy + ay, p.kin.agility, dt);
    p.vx = t.vx;
    p.vy = t.vy;
    if (p.vx * p.vx + p.vy * p.vy > 4) p.heading = Math.atan2(p.vy, p.vx); // face the travel above walking pace
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
          // JOSTLING: the push splits by STRENGTH — the stronger body holds its
          // ground, the lighter one gets moved (same total separation, so the
          // O(n²) axis-reject fast path above is untouched)
          const wa = b.kin.strength / (a.kin.strength + b.kin.strength);
          const wb = 1 - wa;
          a.x = clamp(a.x - ux * push * 2 * wa, 2, 98); a.y = clamp(a.y - uy * push * 2 * wa, 2, 98);
          b.x = clamp(b.x + ux * push * 2 * wb, 2, 98); b.y = clamp(b.y + uy * push * 2 * wb, 2, 98);
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
    // the coach re-reads the match at halftime / ~60' / ~75' (goals retrigger him too)
    const bucket = matchProgress >= 0.75 ? 3 : matchProgress >= 0.6 ? 2 : matchProgress >= 0.5 ? 1 : 0;
    if (bucket !== coachBucket) { coachBucket = bucket; recoach(true); }
    for (const s of ["home", "away"] as const) {
      if (plan[s].t > 0) { plan[s].t -= dt; if (plan[s].t <= 0) plan[s].flank = null; }
    }
    if (captionT > 0) captionT -= dt;
    if (settleT > 0) settleT -= dt;
    if (breakT > 0) { breakT -= dt; if (breakT <= 0) breakSide = null; }
    for (const p of all) if (p.runT > 0) { p.runT -= dt; if (p.side !== poss) p.runT = 0; } // runs die on turnover
    if (resetT > 0) {
      // post-goal moment: no play — everyone jogs back toward their formation anchor
      resetT -= dt;
      for (const p of all) {
        if (sentOff.has(p.id)) continue;
        p.tx = p.ax;
        p.ty = p.ay;
        steer(p, false, dt);
      }
      if (resetT <= 0 && kickoffPending) { const to = kickoffPending; kickoffPending = null; kickoff(to); }
      return;
    }
    // ball height: gravity pulls it down, then it settles on the pitch (with a small bounce)
    ball.z += ball.vz * dt;
    ball.vz -= GRAVITY * dt;
    if (ball.z <= 0) {
      ball.z = 0;
      if (ball.vz < -8) {
        ball.vz = -ball.vz * 0.3;
        // BOUNCE-SPIN: sidespin BITES on contact — one perpendicular impulse, so a
        // whipped delivery skids OFF its line at the bounce (and sheds spin doing it)
        if (ball.spin !== 0) {
          const k = 0.16 * ball.spin;
          const vx0 = ball.vx;
          ball.vx += -ball.vy * k;
          ball.vy += vx0 * k;
          ball.spin *= 0.55;
        }
      } else ball.vz = 0;
    }
    if (ballState === "dribble" || ballState === "pass") possFrames[poss] += 1;
    updateWall();

    if (ballState === "shot" && scoreSide) {
      integrateBall(dt, SHOT_FRICTION);
      if (scoreSide === "home" ? ball.y >= 97 : ball.y <= 3) {
        const conceding: Side = scoreSide === "home" ? "away" : "home";
        scoreSide = null;
        ball.vx = 0; ball.vy = 0; ball.z = 0; ball.vz = 0;
        ballState = "loose";
        resetT = 1.1;
        kickoffPending = conceding; // same post-goal moment as a produced goal
      }
    } else if (ballState === "attempt" && attemptSide) {
      integrateBall(dt, SHOT_FRICTION);
      const attSide: Side = attemptSide; // stable narrowing (branches below null attemptSide)
      const defSide: Side = attSide === "home" ? "away" : "home";
      const blocker = penaltyShot ? undefined : team(defSide).find((d) => dist(d.x, d.y, ball.x, ball.y) < BLOCK_R);
      if (blocker) {
        if (blocker.role === "Goleiro") { goalKick(defSide, "Defesa!"); ticker("Defesa"); }
        else if (R() < 0.22) {
          // the block deflects behind the byline — corner (a real corner source)
          corner(attSide);
        } else {
          ball.vx = ball.vx * -0.25 + rnd(-14, 14);
          ball.vy = ball.vy * -0.25 + rnd(-6, 6);
          ball.spin = 0; // the deflection kills any organized spin
          ballState = "loose";
          lastTouch = defSide;
          caption("Bloqueio!");
          ticker("Bloqueio");
        }
        attemptSide = null;
      } else {
        const reached = attemptSide === "home" ? ball.y >= 95 : ball.y <= 5;
        if (reached) {
          penaltyShot = false;
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
              // a keeper caught off his line (a sweep gone wrong, a scramble) guards an
              // open net — his save chance collapses with distance from goal
              // free radius 17 covers NORMAL lateral shading (gx clamps to 34-66 → up to
              // ~16.5 from goal-centre); only a genuinely stranded keeper (a sweep gone
              // wrong, 20+) loses his save
              const gkOut = gk ? clamp(1 - Math.max(0, dist(gk.x, gk.y, OWN[gk.side].x, OWN[gk.side].y) - 17) / 10, 0.12, 1) : 1;
              const save = (gk ? clamp(0.5 + (gk.rating - 70) / 90, 0.42, 0.82) : 0.5) * gkOut;
              // conversion drifts up late: tired defenders close down slower, so the same
              // position yields a cleaner strike (the resolve-side half of the fatigue fade)
              // ×0.75: re-anchored at 180s — the longer clock's on-target population
              // converted ~25% hot (P(goal|onT) 0.37 vs real ~0.30)
              const pGoal = clamp(attemptXG * 0.75 * (1 + 0.16 * matchProgress) * ((1 - save) / (1 - 0.62)), 0.02, 0.95);
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
              ball.spin = 0;
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
        // Z-GATE: a flighted ball (z ≥ 2.4) sails OVER ground contests — nobody
        // "intercepts" a ball above his head. Contests resume as it drops.
        const airborne = ball.z >= 2.4;
        // THE DROP of a cross = an AERIAL DUEL: nearest attacker vs nearest defender
        // crash for the header — attacker wins → the header shot; defender wins → a
        // headed CLEARANCE (football's most recognizable defensive beat), whose loose
        // drop feeds second-ball scrambles and byline corners organically.
        if ((pendingCross || loftedPass) && !airborne && ball.vz < 0 && ball.z > 0.3) {
          const atts = team(rec.side).filter((o) => o.role !== "Goleiro");
          const defs = opp(rec.side).filter((o) => o.role !== "Goleiro");
          if (atts.length && defs.length) {
            const att = nearest(atts, ball.x, ball.y);
            const def = nearest(defs, ball.x, ball.y);
            const da = dist(att.x, att.y, ball.x, ball.y);
            const dd = dist(def.x, def.y, ball.x, ball.y);
            const isCrossDrop = pendingCross;
            if (!isCrossDrop && (da < 5.5 || dd < 5.5)) {
              // MIDFIELD KNOCK-DOWN (a punt/switch landing): whoever wins the leap
              // brings it down for his side — the endless header duels of real goal kicks
              loftedPass = false;
              const pAtt = clamp(0.5 + (att.rating - def.rating) / 60 + (dd - da) * 0.06, 0.15, 0.85);
              const winner = dd >= 5.5 || (da < 5.5 && R() < pAtt) ? att : def;
              const gW = ATTACK[winner.side];
              if (winner.side === rec.side && dist(winner.x, winner.y, gW.x, gW.y) < 26 && R() < 0.3) {
                // the SECOND-BALL VOLLEY: an attacker winning the knock-down at the edge
                // of the box hits it first time — a staple real chance
                lastTouch = winner.side;
                shoot(winner);
              } else if (R() < 0.3) {
                // the knock-down squirts loose — a genuine 50/50 second ball
                ball.vx = winner.vx * 0.4 + rnd(-14, 14);
                ball.vy = winner.vy * 0.4 + rnd(-8, 8);
                ball.z = 0.4; ball.vz = 0; ball.spin = 0;
                ballState = "loose";
                passTo = null;
                lastTouch = winner.side;
              } else giveBallTo(winner);
            } else if (isCrossDrop && (da < 4.2 || dd < 3.5)) {
              pendingCross = false;
              loftedPass = false;
              // rating decides the leap, defenders get position, proximity matters
              const pAtt = clamp(0.5 + (att.rating - def.rating) / 60 + (dd - da) * 0.06, 0.15, 0.85);
              if (da < 4.2 && (dd >= 3.5 || R() < pAtt)) { lastTouch = att.side; shoot(att, true); }
              else if (R() < 0.18) {
                // under pressure the defender puts it BEHIND for a corner — the safe out
                corner(rec.side);
              } else {
                const g = OWN[def.side];
                const d0 = Math.max(1, dist(ball.x, ball.y, g.x, g.y));
                ball.vx = ((ball.x - g.x) / d0) * 40 + rnd(-12, 12);
                ball.vy = ((ball.y - g.y) / d0) * 40 + rnd(-6, 6);
                ball.z = Math.max(ball.z, 1);
                ball.vz = rnd(9, 14);
                ball.spin = 0;
                ballState = "loose";
                passTo = null;
                lastTouch = def.side;
                caption("Afastou!");
                ticker("Afastou de cabeça");
              }
            }
          }
        }
        if (ballState === "pass" && passTo) {
          const int = nearest(opp(rec.side).filter(canContest), ball.x, ball.y);
          // tired legs read passes worse late (the real late-game defensive fade)
          const intReach = CONTROL * (0.85 + (int.rating - 70) / 110) * (1 - 0.18 * matchProgress);
          // asymmetric aerial reach: the RECEIVER is set for the flight — he kills a
          // dropping ball with chest/thigh (z<3.2, a longer reach); an INTERCEPTOR
          // can't nick a ball above his head (z<2.4). The z-gate stays honest without
          // starving reception (the bisect showed a symmetric gate cost ~2 shots/team).
          if (ball.z < 3.2 && ball.vz <= 0.01 && dist(ball.x, ball.y, rec.x, rec.y) < CONTROL + 0.8) {
            if (pendingCross && rec.role !== "Goleiro") { pendingCross = false; lastTouch = rec.side; shoot(rec, true); }
            else receive(rec); // the first touch can betray him
          } else if (!airborne && dist(int.x, int.y, ball.x, ball.y) < intReach) { pendingCross = false; receive(int); } // a stuck-out leg spills too
          else if (ballSpeed() < 9 && ball.z < 1.2) { pendingCross = false; loftedPass = false; ballState = "loose"; } // a landed, slowing ball is anyone's
        }
      }
    } else if (ballState === "dribble" && carrier) {
      // DEAD BALL (free kick / penalty / corner being placed): the ball stays PUT and
      // nobody may challenge — the taker is walking to it; the restart fires when the
      // ceremony window (decideT) expires. Without this the ball glided to wherever
      // the taker stood and opponents tackled him over a dead ball.
      const deadBall = decideT > 0 && (freeKick || penaltyFor !== null || cornerDelivery);
      if (deadBall) {
        // the ball stays PUT; the taker (carrier) walks to it via the movement loop
        // below — do NOT return here or nobody moves and the restart deadlocks
        ball.vx = 0;
        ball.vy = 0;
        decideT -= dt;
        // the referee waits for the taker: the window can't expire until he's over
        // the ball (he sprints to it as the carrier — bounded wait)
        if (dist(carrier.x, carrier.y, ball.x, ball.y) > 6) decideT = Math.max(decideT, 0.05);
        if (decideT <= 0) decide();
      } else {
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
      // rise (real fouls/cards cluster late; the late-goal surge needs the fade too).
      // Inside the box the whistle costs a PENALTY: refs require a clear foul and
      // defenders challenge with real care — without the 0.18 damping the pen rate
      // came out ~1.7/match (real ~0.3).
      const inPenBox = Math.abs(carrier.x - 50) < 22 && (carrier.side === "home" ? carrier.y > 84 : carrier.y < 16);
      // SHIELDING: the carrier keeps his body between ball and tackler — a tackle
      // from the shielded side is throttled (and fouls more: it goes through the
      // man); STRENGTH tilts both sides of the duel.
      const shield = shieldFactor(ball.x - carrier.x, ball.y - carrier.y, presser.x - carrier.x, presser.y - carrier.y);
      const strengthF = clamp(presser.kin.strength / carrier.kin.strength, 0.8, 1.25);
      // per-challenge rate re-anchored at 180s: carriers spend ~3× longer under
      // pressure per match, so the 60s-era 5.6 produced ~28 fouls (real ~22)
      const foulRate = clamp(4.0 * (carrier.rating / presser.rating), 2.3, 6.1) * (1 + 0.3 * matchProgress) * (inPenBox ? 0.16 : 1) * (shield < 0.7 ? 1.2 : 1);
      const tackleRate = clamp(TACKLE_RATE * (presser.rating / carrier.rating), 1.4, 6) * (1 - 0.28 * matchProgress) * shield * strengthF;
      if (settleT > 0) { if (decideT <= 0) decide(); } // grace window — dribble/decide, can't be tackled yet
      else if (near && R() < foulRate * dt) foul(carrier, presser);
      else if (near && R() < tackleRate * dt) giveBallTo(presser);
      else if (decideT <= 0) decide();
      }
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
        const reachZ = best && best.role === "Goleiro" ? 3.2 : 2.4; // hands beat feet in the air
        if (best && ball.z < reachZ && dist(best.x, best.y, ball.x, ball.y) < CONTROL) {
          const g = ATTACK[best.side];
          const own = OWN[best.side];
          if (best.role === "Goleiro" && ballSpeed() < 24 && dist(ball.x, ball.y, own.x, own.y) < 12) {
            // keeper smothers a slow loose ball in its own box → dead ball, ends the
            // keeper/attacker scramble instead of ping-ponging possession
            giveBallTo(best);
            settleT = 0.9; // the keeper has it safe for a beat before distributing
            caption("Defesa do goleiro!");
            ticker("Defesa");
          } else if (best.role !== "Goleiro" && dist(best.x, best.y, g.x, g.y) < 18 && R() < 0.45) { lastTouch = best.side; shoot(best); }
          else receive(best); // collecting a moving loose ball is a touch like any other
        }
      }
    }

    const defenders = opp(poss).filter((p) => p.role !== "Goleiro");
    // UNIT PRESS with HYSTERESIS: the pressing pair PERSISTS — a defender only hands
    // the job to a clearly-closer teammate (2.5+ units), so two near-equidistant
    // defenders stop flickering roles every frame and the press reads as two committed
    // men. A BACK-PASS (the classic trigger) hands the press to the nearest man at
    // once. Squared distances, no per-tick sort — cheaper than the old full sort.
    const near2 = (q: P | null, x: number, y: number) => (q ? (q.x - x) * (q.x - x) + (q.y - y) * (q.y - y) : Infinity);
    const backPass = ballState === "pass" && passTo && (poss === "home" ? ball.vy < -6 : ball.vy > 6);
    if (presserA && (presserA.side === poss || sentOff.has(presserA.id))) presserA = null; // possession flipped — the old press is void
    if (presserB && (presserB.side === poss || sentOff.has(presserB.id))) presserB = null;
    if (defenders.length) {
      const nearest2 = nearest(defenders, ball.x, ball.y);
      const dNew = near2(nearest2, ball.x, ball.y);
      if (!presserA || backPass || dNew + 6.25 < near2(presserA, ball.x, ball.y) - 5 * Math.sqrt(dNew)) {
        // hand over when clearly closer: d_new + 2.5 < d_old (compare via squares
        // (d+2.5)^2 = d^2 + 5d + 6.25 — the sqrt term uses the NEW distance as the
        // bound, conservative + cheap)
        if (nearest2 !== presserB) presserA = nearest2;
      }
      if (presserB && near2(presserB, ball.x, ball.y) > 900) presserB = null; // stranded cover (30+) — release
      if (!presserB || presserB === presserA) {
        // the SECOND man COVERS: nearest defender that isn't the first presser
        let cover: P | null = null;
        let cd = Infinity;
        for (const d of defenders) {
          if (d === presserA) continue;
          const dd = (d.x - ball.x) * (d.x - ball.x) + (d.y - ball.y) * (d.y - ball.y);
          if (dd < cd) { cd = dd; cover = d; }
        }
        presserB = cover;
      }
    } else { presserA = null; presserB = null; }
    const pressers = [presserA, presserB].filter((x): x is P => x !== null);
    let chaseA: P | null = null;
    let chaseB: P | null = null;
    if (ballState === "pass" && passTo) { chaseA = passTo; chaseB = nearest(opp(passTo.side).filter(canContest), ball.x, ball.y); }
    else if (ballState === "loose") { chaseA = nearest((restartFor ? team(restartFor) : all).filter(canContest), ball.x, ball.y); }

    // REACTION LAG (A2.5): a change of play (pass away, turnover, shot, restart)
    // leaves everyone except the man on the ball and the intended receiver flat-
    // footed for their personal reaction time — through-balls beat defenders who
    // genuinely haven't reacted yet, not defenders who forgot to retarget.
    const phaseKey = ballState + "|" + (carrier ? carrier.id : "") + "|" + poss;
    if (phaseKey !== lastPhaseKey) { lastPhaseKey = phaseKey; phaseSeq++; }
    for (const p of all) {
      if (sentOff.has(p.id)) continue; // sent off — off the pitch
      p.rt -= dt;
      if (p.seenSeq !== phaseSeq) {
        p.seenSeq = phaseSeq;
        if (p !== carrier && p !== passTo) p.lagT = p.kin.reaction;
      }
      if (p.lagT > 0) p.lagT -= dt;
      const chasing = p === chaseA || p === chaseB;
      const lagged = p.lagT > 0 && p !== carrier && p !== passTo && !wallPos.has(p);
      if (!lagged && (p === carrier || chasing || p.rt <= 0 || wallPos.has(p) || cornerDelivery)) {
        const t = target(p, pressers.includes(p), chasing);
        p.tx = t.tx; p.ty = t.ty;
        p.rt = p === carrier || chasing ? 0.1 : rnd(0.35, 0.8);
      }
      // a keeper whose target is far off his line is SWEEPING — that's a sprint;
      // a COMMITTED RUN is a dart, not a jog
      const sprint = p === carrier || chasing || pressers.includes(p) || ballState === "attempt"
        || p.runT > 0 || (p.role === "Goleiro" && dist(p.x, p.y, p.tx, p.ty) > 7);
      steer(p, sprint, dt);
    }
    separate(dt);
  }

  function scoreFor(side: Side) {
    // the cosmetic route's authoritative override: entering it VOIDS any pending
    // ceremony/moment (penalty, post-goal reset, break) — the review found scoreFor
    // during a reset was swallowed by the pending kickoff and left scoreSide stale
    resetT = 0;
    kickoffPending = null;
    penaltyFor = null;
    penaltyShot = false;
    freeKick = false;
    cornerDelivery = false;
    breakT = 0;
    breakSide = null;
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
    ball.spin = 0;
    ticker("⚽ GOL");
  }

  function snapshot(): Snapshot {
    const totalP = possFrames.home + possFrames.away;
    return {
      home: home.map((p) => ({ x: p.x, y: p.y, f: sector8(p.heading) })),
      away: away.map((p) => ({ x: p.x, y: p.y, f: sector8(p.heading) })),
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
      stats: { shots: { ...shots }, onTarget: { ...onTarget }, corners: { ...corners }, fouls: { ...foulsBy }, pens: { ...pens } },
    };
  }

  return { step, snapshot, scoreFor, getResult };
}
