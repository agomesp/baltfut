"use client";

// PROTOTYPE (v2/v3, /subtests2 only) — procedural / IK player bodies, à la Rain World.
//
// Same match engine + props as the v1 pitch, but the field/players/ball are drawn on a
// CANVAS with spring-skeletons instead of billboard dot-tokens. Each body is driven by
// the sim's authoritative position + a velocity DERIVED here by finite difference (no
// change to match-sim): velocity → facing/stride/lean, speed → gait cadence, acceleration
// → torso lean. Legs FOOT-PLANT in field space (feet stick to the pitch, the body glides
// over them; knees bend forward via 2-bone analytic IK; the swing foot re-aims each frame
// so it lands under the body — no ice-skating). Arms swing for balance; on a struck ball
// the nearest player KICKS (leg sweeps toward the ball); on a foul the nearest player
// RAGDOLLS to the turf then gets up. A "RETRO" toggle swaps the stick-skeleton skin for
// chunky pixel bodies (physics motion + pixel skin = the Rain-World mesh-over-physics idea).
// 100% COSMETIC / read-only — it never feeds the sim (spike's integer-authority rule).
//
// Coords: x = width 0..100, y = length 0..100 (0 = near/bottom, 100 = far/top).

import { useEffect, useMemo, useRef, useState } from "react";
import { FlagIcon } from "@/components/live/bf-ui";
import type { Team } from "@/lib/subs-draft/engine";
import { fieldLayout, type FieldSlot, type Lineup } from "@/lib/subs-draft/squad";
import { createMatchSim, type MatchSim, type Snapshot } from "@/lib/subs-draft/match-sim";
import { createProgressClock, lerpSnapshot, reconcileEvents, FIXED_DT, type ProgressClock } from "@/lib/subs-draft/sim-clock";
import { TOTAL_STEPS } from "@/lib/subs-draft/sim-timing";
import { subscribeMetronome } from "@/lib/subs-draft/sim-metronome";

const HOME = "#c8ff2d";
const AWAY = "#5fb0ff";
const GK = "#f2a93b";
const SKIN = "#e7b98c";
const MONO = "var(--font-jb, ui-monospace)";
const DISP = "var(--font-bric, system-ui)";

const W = 760;
const H = 600;
const NEAR_Y = H * 0.95;
const FAR_Y = H * 0.11;
const NEAR_HW = W * 0.475;
const FAR_HW = W * 0.27;
const NEAR_S = 1.18;
const FAR_S = 0.5;

type Style = "ik" | "pixel";
interface Pt { x: number; y: number }
/** a player position + the sim's quantized 8-way facing (sector8: 0=+x/right, 2=away, 4=left, 6=toward camera) */
interface FPt extends Pt { f: number }
export interface Skel {
  feet: [Pt, Pt];
  swing: number; swingT: number; target: Pt;
  vx: number; vy: number; ax: number; ay: number;
  gait: number; lean: number;
  kickT: number; kx: number; ky: number; // kick timer + direction
  fall: number;                           // ragdoll timer (s), >0 = on the ground
}

function proj(fx: number, fy: number) {
  const t = fy / 100;
  const sy = NEAR_Y + (FAR_Y - NEAR_Y) * t;
  const hw = NEAR_HW + (FAR_HW - NEAR_HW) * t;
  const sx = W / 2 + (fx / 100 - 0.5) * 2 * hw;
  const s = NEAR_S + (FAR_S - NEAR_S) * t;
  return { sx, sy, s };
}
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export default function PitchView({
  home, away, homeLineup, awayLineup, homeCode, awayCode, clock, playing, seed, progressAt,
}: {
  home: Team; away: Team; homeLineup: Lineup; awayLineup: Lineup;
  homeCode: string; awayCode: string; clock: number; playing: boolean; seed?: number;
  /** Smooth match progress (0..1) at a given performance.now(). Lets the pitch step
   * the sim ~1 tick/frame between the parent's coarse clock samples; falls back to
   * clock/90. The sim is now AUTHORITATIVE (xG-unification): goals emerge from play. */
  progressAt?: (nowMs: number) => number;
}) {
  const homeXI = useMemo(() => fieldLayout(home, homeLineup, "home"), [home, homeLineup]);
  const awayXI = useMemo(() => fieldLayout(away, awayLineup, "away"), [away, awayLineup]);

  const [caption, setCaption] = useState<string | null>(null);
  const [stats, setStats] = useState<{ possHome: number; shots: { home: number; away: number } }>({ possHome: 0.5, shots: { home: 0, away: 0 } });
  const [ticker, setTicker] = useState<{ min: number; text: string }[]>([]);
  const [cardFlash, setCardFlash] = useState<{ type: "yellow" | "red"; id: number } | null>(null);
  const [flash, setFlash] = useState<{ teamId: string; scorer: string } | null>(null);
  const [score, setScore] = useState<{ home: number; away: number }>({ home: 0, away: 0 });
  const [style, setStyle] = useState<Style>("ik");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const simRef = useRef<MatchSim | null>(null);
  const lastTs = useRef(0);
  const progressRef = useRef(0);
  const progressAtRef = useRef(progressAt);
  const styleRef = useRef<Style>("ik");
  const prevGoalsRef = useRef<{ home: number; away: number }>({ home: 0, away: 0 });
  const bookingsSig = useRef("");
  const eventSeqRef = useRef(0);
  const sentOffRef = useRef<Set<string>>(new Set());
  const bookRef = useRef<Record<string, "yellow" | "red">>({});
  const trailRef = useRef<Pt[]>([]);
  // Stage 3: a PROGRESS-driven fixed-step clock + the two most-recent AUTHORITATIVE
  // snapshots. The sim runs {scoring} so goals emerge from play; the clock pulls it to
  // the step matching the match minute (headless==live). The render interpolates between
  // the two snapshots. prevBallSpeed/lastCap track cosmetic kick/foul edges.
  const simClockRef = useRef<ProgressClock | null>(null);
  const prevSnapRef = useRef<Snapshot | null>(null);
  const currSnapRef = useRef<Snapshot | null>(null);

  const prevBallSpeed = useRef(0);
  const lastCap = useRef<string | null>(null);
  useEffect(() => { progressRef.current = clock / 90; }, [clock]);
  useEffect(() => { progressAtRef.current = progressAt; }, [progressAt]);
  useEffect(() => { styleRef.current = style; }, [style]);

  const skels = useRef<{ home: Skel[]; away: Skel[] }>({ home: [], away: [] });
  useEffect(() => {
    const mk = (xi: FieldSlot[]): Skel[] => xi.map((a) => ({
      feet: [{ x: a.x - 1.1, y: a.y }, { x: a.x + 1.1, y: a.y }], swing: -1, swingT: 0, target: { x: a.x, y: a.y },
      vx: 0, vy: 0, ax: 0, ay: 0, gait: Math.random() * 6.28, lean: 0, kickT: 0, kx: 0, ky: 1, fall: 0,
    }));
    skels.current = { home: mk(homeXI), away: mk(awayXI) };
    // xG-unification: the spotlight sim is AUTHORITATIVE ({scoring}) and seeded with the
    // SAME seed the headless scoring run used, so the live match reaches the identical
    // scoreline. The progress clock pulls it to the step matching the match minute.
    const sim = createMatchSim(homeXI, awayXI, seed, { scoring: true });
    simRef.current = sim;
    simClockRef.current = createProgressClock((dt) => sim.step(dt), TOTAL_STEPS);
    const snap0 = sim.snapshot();
    prevSnapRef.current = snap0;
    currSnapRef.current = snap0;
    // sentinel: the next pump resyncs the scoreboard to the (fresh) sim's tally without
    // firing a spurious goal flash (see the pg.home >= 0 guard). A new match remounts
    // via key= so score state also resets on its own; this covers a mid-match rebuild.
    prevGoalsRef.current = { home: -1, away: -1 };
  }, [homeXI, awayXI, seed]);

  useEffect(() => {
    if (!playing) return;
    const ctx = canvasRef.current?.getContext("2d");
    lastTs.current = 0;
    let raf = 0;
    const flashTimers = new Set<ReturnType<typeof setTimeout>>(); // card-flash dismissals to cancel on unmount

    // AUTHORITY: pull the sim forward to the step matching the match PROGRESS (smooth
    // via progressAt, falling back to the coarse clock), then read the snapshot ONCE
    // and refresh overlay + authoritative velocity. Progress-based, so calling it from
    // both rAF and the worker metronome (A0.3) never double-steps.
    const pump = (nowMs: number) => {
      const sim = simRef.current;
      const clk = simClockRef.current;
      if (!sim || !clk) return;
      const p = progressAtRef.current ? progressAtRef.current(nowMs) : progressRef.current;
      const ran = clk.advance(p);
      if (ran <= 0) return;
      const base = currSnapRef.current ?? sim.snapshot();
      const snap = sim.snapshot();
      prevSnapRef.current = base;
      currSnapRef.current = snap;
      const invStep = 1 / (FIXED_DT * ran); // per-second velocity over the steps just run

      // overlay state
      setCaption((c) => (snap.caption !== c ? snap.caption : c));
      setStats((s) => (s.possHome !== snap.possHome || s.shots.home !== snap.shots.home || s.shots.away !== snap.shots.away ? { possHome: snap.possHome, shots: snap.shots } : s));
      const sig = Object.entries(snap.bookings).map(([k, v]) => k + v).join(",");
      if (sig !== bookingsSig.current) { bookingsSig.current = sig; bookRef.current = snap.bookings; }
      if (snap.sentOff.length !== sentOffRef.current.size) sentOffRef.current = new Set(snap.sentOff);

      // goals: the pitch PRODUCES them now. Track the live tally for the scoreboard and
      // fire the GOOOL flash on the increment edge (suppressed during a catch-up burst).
      const pg = prevGoalsRef.current;
      if (snap.goals.home !== pg.home || snap.goals.away !== pg.away) {
        const scoredHome = snap.goals.home > pg.home;
        // a real goal (prev was a genuine tally, not the -1 resync sentinel)
        const scored = pg.home >= 0 && (scoredHome || snap.goals.away > pg.away);
        prevGoalsRef.current = { home: snap.goals.home, away: snap.goals.away };
        setScore({ home: snap.goals.home, away: snap.goals.away });
        if (scored && !clk.wasCapped()) {
          const gev = sim.getResult().events.filter((e) => e.type === "goal");
          const last = gev[gev.length - 1];
          const teamId = last ? (last.side === "home" ? home.id : away.id) : scoredHome ? home.id : away.id;
          setFlash({ teamId, scorer: last?.player ?? "" });
          const t = setTimeout(() => { flashTimers.delete(t); setFlash((f) => (f ? null : f)); }, 1600);
          flashTimers.add(t);
        }
      }

      // events: at most ONE ticker line per pump; a catch-up (resync) skips the
      // transient flashes rather than replaying a burst of stale captions.
      const rec = reconcileEvents(eventSeqRef.current, snap, clk.wasCapped());
      if (rec.ticker.length) {
        eventSeqRef.current = rec.nextSeq;
        if (!rec.resync) {
          setTicker((t) => [{ min: Math.round(progressRef.current * 90), text: snap.eventText }, ...t].slice(0, 6));
          if (/Vermelho|Amarelo/.test(snap.eventText)) {
            const id = snap.eventSeq;
            const type = /Vermelho/.test(snap.eventText) ? "red" : "yellow";
            setCardFlash({ type, id });
            const h = setTimeout(() => { flashTimers.delete(h); setCardFlash((cf) => (cf?.id === id ? null : cf)); }, 1700);
            flashTimers.add(h);
          }
        }
      }

      // ball velocity + kick / foul detection — from the authoritative prev→curr
      const bv = { x: (snap.ball.x - base.ball.x) * invStep, y: (snap.ball.y - base.ball.y) * invStep };
      const bspeed = Math.hypot(bv.x, bv.y);
      const nearestToBall = () => {
        let best: Skel | null = null, bd = Infinity;
        const scan = (pos: Pt[], sk: Skel[]) => pos.forEach((p, i) => { const d = Math.hypot(p.x - snap.ball.x, p.y - snap.ball.y); if (d < bd) { bd = d; best = sk[i]; } });
        scan(snap.home, skels.current.home); scan(snap.away, skels.current.away);
        return { s: best as Skel | null, d: bd };
      };
      if (!clk.wasCapped() && prevBallSpeed.current < 22 && bspeed > 34) { // a ball was just STRUCK
        const nb = nearestToBall();
        if (nb.s && nb.d < 3.2 && nb.s.fall <= 0) { const n = Math.max(1, bspeed); nb.s.kickT = 0.3; nb.s.kx = bv.x / n; nb.s.ky = bv.y / n; }
      }
      if (!clk.wasCapped() && snap.caption === "Falta!" && lastCap.current !== "Falta!") { // a foul → ragdoll the nearest man
        const nb = nearestToBall();
        if (nb.s) nb.s.fall = 1.0;
      }
      lastCap.current = snap.caption;
      prevBallSpeed.current = bspeed;

      // per-player AUTHORITATIVE velocity (the gait PHASE advances on the render frame)
      const updVel = (cur: Pt[], pv: Pt[], sk: Skel[]) => {
        cur.forEach((p, i) => {
          const s = sk[i]; if (!s) return;
          updateSkelVel(s, p, pv[i], invStep);
        });
      };
      updVel(snap.home, base.home, skels.current.home);
      updVel(snap.away, base.away, skels.current.away);
    };
    // A0.3: keep the sim advancing while the tab is hidden (rAF is paused there).
    // The worker metronome and rAF both drive the SAME elapsed-based pump, so they
    // never double-step; drawing stays in the rAF frame (a hidden tab can't paint).
    const unsubMetro = subscribeMetronome(() => pump(performance.now()));

    const frame = () => {
      const now = performance.now();
      pump(now);
      const rdt = Math.min(0.05, (now - (lastTs.current || now)) / 1000);
      lastTs.current = now;
      const cur = currSnapRef.current;
      if (ctx && cur) {
        const prev = prevSnapRef.current;
        // RENDER (cosmetic, read-only): interpolate positions between the two
        // authoritative snapshots; gait animates on the render frame.
        const view = prev ? lerpSnapshot(prev, cur, simClockRef.current?.alpha() ?? 0) : cur;
        const gait = (pos: Pt[], sk: Skel[]) => pos.forEach((p, i) => { const s = sk[i]; if (s) stepGait(s, p, rdt); });
        gait(view.home, skels.current.home);
        gait(view.away, skels.current.away);
        trailRef.current = [{ ...view.ball }, ...trailRef.current].slice(0, 7);
        draw(ctx, {
          homeXI, awayXI, homePos: view.home, awayPos: view.away, ball: view.ball,
          homeSkel: skels.current.home, awaySkel: skels.current.away,
          bookings: bookRef.current, sentOff: sentOffRef.current, trail: trailRef.current, style: styleRef.current,
        });
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); unsubMetro(); flashTimers.forEach(clearTimeout); };
  }, [playing, homeXI, awayXI, home.id, away.id]);

  return (
    <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", border: "1px solid rgba(200,255,45,0.18)", background: "#06140b" }}>
      <div style={{ position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)", zIndex: 5, display: "flex", alignItems: "center", gap: 12, background: "rgba(0,0,0,0.55)", padding: "6px 14px", borderRadius: 999 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: MONO, fontSize: 13, color: HOME }}><FlagIcon code={homeCode} size={13} /> {homeCode}</span>
        <span style={{ fontFamily: DISP, fontSize: 20, fontWeight: 800, color: "#fff" }}>{score.home} <span style={{ color: "#6f7d73" }}>×</span> {score.away}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: MONO, fontSize: 13, color: AWAY }}>{awayCode} <FlagIcon code={awayCode} size={13} /></span>
        <span style={{ fontFamily: MONO, fontSize: 12, color: "#9fb0a4", marginLeft: 4 }}>{Math.round(clock)}&apos;</span>
      </div>

      <button
        onClick={() => setStyle((s) => (s === "ik" ? "pixel" : "ik"))}
        style={{ position: "absolute", top: 12, right: 12, zIndex: 6, fontFamily: MONO, fontSize: 10, fontWeight: 800, padding: "5px 10px", borderRadius: 999, border: "1px solid rgba(200,255,45,0.4)", background: "rgba(0,0,0,0.55)", color: HOME, cursor: "pointer" }}
      >
        {style === "ik" ? "◍ IK · trocar p/ RETRO" : "▦ RETRO · trocar p/ IK"}
      </button>

      {caption && (
        <div style={{ position: "absolute", top: 44, left: "50%", transform: "translateX(-50%)", zIndex: 5, fontFamily: DISP, fontSize: 15, fontWeight: 800, letterSpacing: 0.5, color: "#ffe27a", textShadow: "0 2px 8px rgba(0,0,0,0.7)", pointerEvents: "none" }}>{caption}</div>
      )}
      {ticker.length > 0 && (
        <div style={{ position: "absolute", top: 40, left: 12, zIndex: 5, display: "grid", gap: 2, pointerEvents: "none" }}>
          {ticker.map((e, i) => (
            <div key={ticker.length - i + e.min} style={{ fontFamily: MONO, fontSize: 10.5, color: i === 0 ? "#e7f0e9" : "rgba(159,176,164,0.7)", textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>
              <span style={{ color: "#7e8f84" }}>{e.min}&apos;</span> {e.text}
            </div>
          ))}
        </div>
      )}

      <div style={{ padding: "54px 10px 66px", display: "flex", justifyContent: "center" }}>
        <canvas ref={canvasRef} width={W} height={H} style={{ width: "100%", maxWidth: 560, height: "auto", display: "block" }} />
      </div>

      <div style={{ position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)", zIndex: 5, width: "min(86%, 420px)", background: "rgba(0,0,0,0.5)", borderRadius: 10, padding: "7px 12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 10, color: "#9fb0a4", marginBottom: 4 }}>
          <span style={{ color: HOME }}>{homeCode} · {Math.round(stats.possHome * 100)}%</span>
          <span>POSSE DE BOLA</span>
          <span style={{ color: AWAY }}>{Math.round((1 - stats.possHome) * 100)}% · {awayCode}</span>
        </div>
        <div style={{ display: "flex", height: 6, borderRadius: 999, overflow: "hidden", background: "rgba(255,255,255,0.1)" }}>
          <div style={{ width: `${stats.possHome * 100}%`, background: HOME }} />
          <div style={{ width: `${(1 - stats.possHome) * 100}%`, background: AWAY }} />
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 5, fontFamily: MONO, fontSize: 11, color: "#dfe8e0" }}>
          <span style={{ color: HOME, fontWeight: 700 }}>{stats.shots.home}</span>
          <span style={{ color: "#7e8f84" }}>⚽ chutes</span>
          <span style={{ color: AWAY, fontWeight: 700 }}>{stats.shots.away}</span>
        </div>
      </div>

      {flash && (
        <div style={{ position: "absolute", inset: 0, zIndex: 6, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.35)", pointerEvents: "none" }}>
          <div style={{ fontFamily: DISP, fontSize: 52, fontWeight: 900, color: flash.teamId === home.id ? HOME : AWAY, textShadow: "0 4px 24px rgba(0,0,0,0.6)", animation: "subGoalPop 0.4s ease-out" }}>GOOOL!</div>
          <div style={{ fontFamily: MONO, fontSize: 14, color: "#fff", marginTop: 4 }}>{flash.scorer}</div>
        </div>
      )}
      {cardFlash && (
        <div style={{ position: "absolute", inset: 0, zIndex: 7, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)", pointerEvents: "none" }}>
          <div style={{ width: 50, height: 72, borderRadius: 6, background: cardFlash.type === "red" ? "#e0322f" : "#f2c531", boxShadow: `0 10px 34px ${cardFlash.type === "red" ? "rgba(224,50,47,0.5)" : "rgba(242,197,49,0.5)"}, 0 4px 10px rgba(0,0,0,0.6)`, transformOrigin: "bottom right", animation: "subCardPop 0.55s cubic-bezier(.2,1.5,.5,1)" }} />
          <div style={{ fontFamily: DISP, fontSize: 19, fontWeight: 800, letterSpacing: 0.5, color: "#fff", marginTop: 14, textShadow: "0 2px 8px rgba(0,0,0,0.7)" }}>{cardFlash.type === "red" ? "CARTÃO VERMELHO" : "CARTÃO AMARELO"}</div>
        </div>
      )}
      <style>{`@keyframes subGoalPop{0%{transform:scale(.6);opacity:0}60%{transform:scale(1.12);opacity:1}100%{transform:scale(1);opacity:1}}@keyframes subCardPop{0%{transform:rotate(-35deg) scale(.3);opacity:0}55%{transform:rotate(10deg) scale(1.12);opacity:1}100%{transform:rotate(0) scale(1);opacity:1}}`}</style>
    </div>
  );
}

/* ─────────────── gait: foot-planting + kick + ragdoll ─────────────── */

// EXPORTED for the gait-integrity test: the pump and the harness must share this
// math — a hand-copied version silently decouples the test from the pipeline.
export function updateSkelVel(s: Skel, p: Pt, q: Pt | undefined, invStep: number) {
  const vx = q ? (p.x - q.x) * invStep : 0, vy = q ? (p.y - q.y) * invStep : 0;
  if (q && Math.hypot(p.x - q.x, p.y - q.y) > 8) { s.feet = [{ x: p.x - 1.1, y: p.y }, { x: p.x + 1.1, y: p.y }]; s.vx = 0; s.vy = 0; s.swing = -1; return; }
  const nax = (vx - s.vx) * invStep, nay = (vy - s.vy) * invStep;
  s.ax += (nax - s.ax) * 0.2; s.ay += (nay - s.ay) * 0.2;
  s.vx += (vx - s.vx) * 0.35; s.vy += (vy - s.vy) * 0.35;
}

// EXPORTED for the gait-integrity test. Anatomical reach is FIELD-isotropic but the
// camera squashes only screen-y (×0.62), and maxLeg is calibrated on the vertically-
// drawn leg — so measure in the y-calibrated metric (a screen-x px is 0.62 y-px of
// anatomy). Without this a legitimate full sprint stride along screen-x near the
// camera got clamped into a visible foot stutter.
export function capFootReach(hip: Pt, f: Pt, maxLeg: number): Pt {
  const dx = f.x - hip.x, dy = f.y - hip.y;
  const d = Math.hypot(dx * 0.62, dy);
  return d > maxLeg ? { x: hip.x + dx * (maxLeg / d), y: hip.y + dy * (maxLeg / d) } : f;
}

// exported for the headless gait-integrity test (feet must never stream away from bodies)
export function stepGait(s: Skel, p: Pt, dt: number) {
  if (s.fall > 0) { s.fall -= dt; return; } // on the ground — freeze the gait
  const speed = Math.hypot(s.vx, s.vy);
  let dx = s.vx, dy = s.vy;
  if (speed > 0.4) { dx /= speed; dy /= speed; } else { dx = 0; dy = 1; }
  const perp = { x: -dy, y: dx };
  const stance = 1.05;
  const homeL = { x: p.x + perp.x * -stance, y: p.y + perp.y * -stance };
  const homeR = { x: p.x + perp.x * stance, y: p.y + perp.y * stance };

  // HARD SAFETY — in EVERY gait state (kick and idle included; the review found the
  // old moving-branch-only snap left both uncovered): a foot >6 from the body snaps
  // straight home, and any swing pointed at it is cancelled so the fresh radials
  // below can't immediately re-launch a step toward the pre-snap position.
  if (Math.hypot(p.x - s.feet[0].x, p.y - s.feet[0].y) > 6) { s.feet[0] = { x: homeL.x, y: homeL.y }; if (s.swing === 0) s.swing = -1; }
  if (Math.hypot(p.x - s.feet[1].x, p.y - s.feet[1].y) > 6) { s.feet[1] = { x: homeR.x, y: homeR.y }; if (s.swing === 1) s.swing = -1; }

  // KICK: sweep one foot toward the ball direction
  if (s.kickT > 0) {
    s.kickT -= dt;
    const kf = 0; // kicking foot
    s.swing = kf; s.swingT = clamp(s.swingT + dt / 0.24, 0, 1);
    s.feet[kf].x += ((p.x + s.kx * 3.6) - s.feet[kf].x) * Math.min(1, dt * 22);
    s.feet[kf].y += ((p.y + s.ky * 3.6) - s.feet[kf].y) * Math.min(1, dt * 22);
    const plant = 1 - kf;
    s.feet[plant].x += ((plant === 0 ? homeL.x : homeR.x) - s.feet[plant].x) * Math.min(1, dt * 6);
    s.feet[plant].y += ((plant === 0 ? homeL.y : homeR.y) - s.feet[plant].y) * Math.min(1, dt * 6);
    s.lean += (-3 - s.lean) * Math.min(1, dt * 6); // lean back through the kick
    s.gait += dt * 8;
    return;
  }

  if (speed < 1.0) {
    s.feet[0].x += (homeL.x - s.feet[0].x) * Math.min(1, dt * 5);
    s.feet[0].y += (homeL.y - s.feet[0].y) * Math.min(1, dt * 5);
    s.feet[1].x += (homeR.x - s.feet[1].x) * Math.min(1, dt * 5);
    s.feet[1].y += (homeR.y - s.feet[1].y) * Math.min(1, dt * 5);
    s.swing = -1;
  } else {
    const stride = clamp(speed * 0.14, 1.3, 3.0);
    const behind = (f: Pt) => (p.x - f.x) * dx + (p.y - f.y) * dy;
    const b0 = behind(s.feet[0]), b1 = behind(s.feet[1]);
    // RADIAL drag: arcing runners (turn-clamp kinematics) leave feet LATERALLY —
    // invisible to the along-track projection — so measure straight distance too.
    // (Computed AFTER the top-of-function snap, so a just-reset foot reads ~stance
    // and can't force-start a swing from its stale pre-snap distance.)
    const r0 = Math.hypot(p.x - s.feet[0].x, p.y - s.feet[0].y);
    const r1 = Math.hypot(p.x - s.feet[1].x, p.y - s.feet[1].y);
    const radial = Math.max(r0, r1) > 3.4;
    const worst = radial ? (r0 > r1 ? 0 : 1) : b0 > b1 ? 0 : 1;
    // start a step when a foot has fallen behind or drifted wide, or FORCE one if far
    if (s.swing < 0 && (Math.max(b0, b1) > stride * 0.7 || Math.max(b0, b1) > 3.2 || radial)) {
      s.swing = worst; s.swingT = 0;
    }
    if (s.swing >= 0) {
      const f = s.feet[s.swing];
      const off = s.swing === 0 ? -stance : stance;
      // re-aim ahead of the body every frame so the foot lands UNDER the runner (no ice-skate)
      s.target = { x: p.x + dx * stride + perp.x * off, y: p.y + dy * stride + perp.y * off };
      const k = Math.min(1, dt * 15);
      f.x += (s.target.x - f.x) * k;
      f.y += (s.target.y - f.y) * k;
      s.swingT = Math.min(1, s.swingT + dt / clamp(0.3 - speed * 0.006, 0.13, 0.28));
      if (s.swingT >= 1) s.swing = -1;
    }
  }
  s.gait += dt * (2.4 + Math.min(speed, 14) * 0.5);
  const px = proj(p.x + s.vx * 0.02, p.y).sx - proj(p.x, p.y).sx;
  s.lean += (clamp(px * 2.4, -7, 7) - s.lean) * Math.min(1, dt * 6);
}

/* ─────────────── drawing ─────────────── */

interface DrawArgs {
  homeXI: FieldSlot[]; awayXI: FieldSlot[];
  homePos: FPt[]; awayPos: FPt[]; ball: Pt & { z?: number };
  homeSkel: Skel[]; awaySkel: Skel[];
  bookings: Record<string, "yellow" | "red">; sentOff: Set<string>; trail: Pt[]; style: Style;
}

function draw(ctx: CanvasRenderingContext2D, a: DrawArgs) {
  drawField(ctx);
  const bodies: { fy: number; render: () => void }[] = [];
  const push = (xi: FieldSlot[], pos: FPt[], sk: Skel[], base: string) => xi.forEach((slot, i) => {
    if (a.sentOff.has(slot.id)) return;
    const p = pos[i], s = sk[i];
    if (!p || !s) return;
    const col = slot.role === "Goleiro" ? GK : base;
    bodies.push({ fy: p.y, render: () => drawPlayer(ctx, p, s, col, a.bookings[slot.id], a.style) });
  });
  push(a.homeXI, a.homePos, a.homeSkel, HOME);
  push(a.awayXI, a.awayPos, a.awaySkel, AWAY);
  bodies.push({ fy: a.ball.y, render: () => drawBall(ctx, a.ball, a.trail) });
  bodies.sort((x, y) => y.fy - x.fy);
  for (const b of bodies) b.render();
}

function drawField(ctx: CanvasRenderingContext2D) {
  ctx.clearRect(0, 0, W, H);
  for (let i = 0; i < 10; i++) {
    const y0 = i * 10, y1 = y0 + 10;
    const a0 = proj(0, y0), b0 = proj(100, y0), b1 = proj(100, y1), a1 = proj(0, y1);
    ctx.beginPath(); ctx.moveTo(a0.sx, a0.sy); ctx.lineTo(b0.sx, b0.sy); ctx.lineTo(b1.sx, b1.sy); ctx.lineTo(a1.sx, a1.sy); ctx.closePath();
    ctx.fillStyle = i % 2 ? "#1c8139" : "#1a7635"; ctx.fill();
  }
  ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1.6;
  const poly = (pts: number[][], cl = true) => {
    ctx.beginPath();
    pts.forEach(([fx, fy], i) => { const q = proj(fx, fy); if (i === 0) ctx.moveTo(q.sx, q.sy); else ctx.lineTo(q.sx, q.sy); });
    if (cl) ctx.closePath(); ctx.stroke();
  };
  poly([[3, 3], [97, 3], [97, 97], [3, 97]]);
  poly([[3, 50], [97, 50]], false);
  poly([[26, 3], [74, 3], [74, 15], [26, 15]]);
  poly([[26, 97], [74, 97], [74, 85], [26, 85]]);
  poly([[42, 3], [58, 3], [58, 7], [42, 7]]);
  poly([[42, 97], [58, 97], [58, 93], [42, 93]]);
  const circle: number[][] = [];
  for (let k = 0; k <= 24; k++) { const t = (k / 24) * Math.PI * 2; circle.push([50 + Math.cos(t) * 11, 50 + Math.sin(t) * 8]); }
  poly(circle, false);
}

function seg(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, w: number, col: string) {
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
}

// 2-bone analytic IK — knee bent so it juts FORWARD (lower on screen = nearer camera)
function ikLeg(ctx: CanvasRenderingContext2D, hx: number, hy: number, fx: number, fy: number, thigh: number, shin: number, w: number, col: string) {
  const dx = fx - hx, dy = fy - hy;
  const d = clamp(Math.hypot(dx, dy), Math.abs(thigh - shin) + 0.3, thigh + shin - 0.3);
  const base = Math.atan2(dy, dx);
  const A = Math.acos(clamp((thigh * thigh + d * d - shin * shin) / (2 * thigh * d), -1, 1));
  const kp = { x: hx + Math.cos(base + A) * thigh, y: hy + Math.sin(base + A) * thigh };
  const km = { x: hx + Math.cos(base - A) * thigh, y: hy + Math.sin(base - A) * thigh };
  const knee = kp.y >= km.y ? kp : km; // pick the one lower on screen (forward/toward camera)
  seg(ctx, hx, hy, knee.x, knee.y, w, col);
  seg(ctx, knee.x, knee.y, fx, fy, w, col);
  return knee;
}

function footScreen(s: Skel, i: number, legLen: number) {
  const f = proj(s.feet[i].x, s.feet[i].y);
  const lift = s.swing === i ? Math.sin(Math.PI * s.swingT) * legLen * (s.kickT > 0 ? 0.28 : 0.5) : 0;
  return { x: f.sx, y: f.sy - lift };
}

function drawPlayer(ctx: CanvasRenderingContext2D, p: FPt, s: Skel, col: string, card: "yellow" | "red" | undefined, style: Style) {
  const { sx, sy, s: sc } = proj(p.x, p.y);
  // 8-WAY FACING from the sim's authoritative heading: field angle → screen space
  // (field +y is AWAY = up-screen, so the vertical flips and squashes with the camera)
  const fAng = (p.f ?? 6) * (Math.PI / 4);
  const fx = Math.cos(fAng);
  const fy = Math.sin(fAng);
  const sfx = Math.abs(fx) < 1e-9 ? 0 : fx;
  const sfy = -fy * 0.62;
  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); ctx.ellipse(sx, sy, 8 * sc, 3.1 * sc, 0, 0, Math.PI * 2); ctx.fill();

  if (s.fall > 0) { drawFallen(ctx, sx, sy, sc, col); return; }

  const legLen = 15 * sc, thigh = legLen * 0.52, shin = legLen * 0.52;
  const torso = 13 * sc, headR = 4.4 * sc, arm = 11 * sc, lw = style === "pixel" ? 5 * sc : 2.5 * sc;
  const speed = Math.hypot(s.vx, s.vy);
  const bob = speed > 1 && s.kickT <= 0 ? Math.abs(Math.sin(s.gait)) * 1.5 * sc : 0;
  const hip = { x: sx, y: sy - legLen - bob };
  const sho = { x: hip.x + s.lean * sc * 0.7, y: hip.y - torso };
  const head = { x: sho.x + s.lean * sc * 0.3, y: sho.y - headR - 1 };
  const dark = col === AWAY ? "#0a2740" : "#132a10";
  // DRAW-TIME leg clamp: whatever state the gait is in (ragdoll recovery, catch-up
  // bursts, arc drift), a drawn foot never exceeds anatomical reach — a clamped leg
  // reads as a full stride; an unclamped one reads as a shin streak across the pitch.
  const maxLeg = (thigh + shin) * 1.12;
  const f0 = capFootReach(hip, footScreen(s, 0, legLen), maxLeg), f1 = capFootReach(hip, footScreen(s, 1, legLen), maxLeg);
  const legOrder: [{ x: number; y: number }, number][] = f0.y <= f1.y ? [[f0, 0], [f1, 1]] : [[f1, 1], [f0, 0]];

  if (style === "pixel") {
    // chunky RETRO body — jersey block, shorts, socks/boots, blocky limbs, head + hair.
    // The head is FACING-AWARE: back-of-head hair when facing away, fringe + two eyes
    // toward camera, full profile (single eye + side hair) east/west, 3/4 diagonals.
    const short = col === AWAY ? "#0e3a63" : "#20361a";
    const sock = "#101512";
    for (const [f] of legOrder) { ikLeg(ctx, hip.x, hip.y, f.x, f.y, thigh, shin, lw, sock); ctx.fillStyle = "#0b0d0a"; ctx.fillRect(Math.round(f.x - 2.4 * sc), Math.round(f.y - 1.6 * sc), 4.8 * sc, 2.6 * sc); }
    // shorts block
    ctx.fillStyle = short; ctx.fillRect(Math.round(hip.x - 4.4 * sc), Math.round(hip.y - 2 * sc), 8.8 * sc, 5 * sc);
    // arms
    const swing = Math.sin(s.gait) * (0.5 + Math.min(speed, 12) * 0.05);
    for (const sgn of [1, -1]) { const hx = sho.x + sgn * headR * 0.7; const hand = { x: hx + Math.sin(s.gait + (sgn > 0 ? 0 : Math.PI)) * arm * 0.6 + s.lean * sc * 0.3, y: sho.y + arm * (0.7 + 0.3 * Math.cos(swing)) }; seg(ctx, hx, sho.y + 1, hand.x, hand.y, lw * 0.9, col); ctx.fillStyle = SKIN; ctx.fillRect(Math.round(hand.x - 1.4 * sc), Math.round(hand.y - 1.4 * sc), 2.8 * sc, 2.8 * sc); }
    // jersey block (nudged a pixel toward the facing — reads as the chest turning)
    const lean2 = s.lean * sc * 0.4 + sfx * sc * 0.8;
    ctx.fillStyle = col; ctx.fillRect(Math.round(hip.x - 4.6 * sc + lean2), Math.round(sho.y - 1 * sc), 9.2 * sc, torso + 2 * sc);
    ctx.fillStyle = dark; ctx.fillRect(Math.round(hip.x - 4.6 * sc + lean2), Math.round(sho.y - 1 * sc), 9.2 * sc, 1.4 * sc); // collar shade
    // head base
    ctx.fillStyle = SKIN; ctx.fillRect(Math.round(head.x - headR), Math.round(head.y - headR), headR * 2, headR * 2);
    ctx.fillStyle = "#3a2a1c";
    if (fy > 0.35) {
      // facing AWAY (N/NE/NW): the camera sees the back of the head — hair fills it
      ctx.fillRect(Math.round(head.x - headR), Math.round(head.y - headR), headR * 2, headR * 1.5);
    } else {
      ctx.fillRect(Math.round(head.x - headR), Math.round(head.y - headR), headR * 2, headR * 0.9); // fringe
      if (Math.abs(fx) > 0.9) {
        // full profile (E/W): side hair + a single eye toward the facing
        ctx.fillRect(Math.round(fx > 0 ? head.x - headR : head.x + headR * 0.5), Math.round(head.y - headR), headR * 0.5, headR * 1.7);
        ctx.fillStyle = "#141a14";
        ctx.fillRect(Math.round(head.x + (fx > 0 ? headR * 0.3 : -headR * 0.7)), Math.round(head.y - headR * 0.05), headR * 0.4, headR * 0.4);
      } else {
        // toward camera (S) or 3/4 (SE/SW): two eyes, offset toward the facing
        const eo = sfx * headR * 0.45;
        ctx.fillStyle = "#141a14";
        ctx.fillRect(Math.round(head.x - headR * 0.55 + eo), Math.round(head.y - headR * 0.02), headR * 0.42, headR * 0.42);
        ctx.fillRect(Math.round(head.x + headR * 0.15 + eo), Math.round(head.y - headR * 0.02), headR * 0.42, headR * 0.42);
      }
    }
  } else {
    // IK stick skeleton — facing shows as a SHOULDER BAR square to the heading and a
    // nose dot on the head rim (hidden when the player faces away from the camera)
    for (const [f] of legOrder) ikLeg(ctx, hip.x, hip.y, f.x, f.y, thigh, shin, lw, dark);
    const swing = Math.sin(s.gait) * (0.5 + Math.min(speed, 12) * 0.05);
    for (const sgn of [1, -1]) { const hx = sho.x + sgn * headR * 0.7; const hand = { x: hx + Math.sin(s.gait + (sgn > 0 ? 0 : Math.PI)) * arm * 0.7 + s.lean * sc * 0.3, y: sho.y + arm * (0.7 + 0.3 * Math.cos(swing)) }; seg(ctx, hx, sho.y + 1, hand.x, hand.y, lw * 0.8, dark); ctx.fillStyle = SKIN; ctx.beginPath(); ctx.arc(hand.x, hand.y, 1.5 * sc, 0, Math.PI * 2); ctx.fill(); }
    seg(ctx, hip.x, hip.y, sho.x, sho.y, lw * 1.9, col);
    const spx = -sfy, spy = sfx; // screen-perp of the facing = the shoulder line
    seg(ctx, sho.x - spx * headR * 1.15, sho.y - spy * headR * 0.55, sho.x + spx * headR * 1.15, sho.y + spy * headR * 0.55, lw * 1.05, col);
    ctx.fillStyle = SKIN; ctx.beginPath(); ctx.arc(head.x, head.y, headR, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = dark; ctx.lineWidth = sc; ctx.stroke();
    if (fy < 0.35) {
      // the nose — which way is he looking? The gate matches the pixel style's
      // back-of-head threshold (fy > 0.35 = facing away), so the two renderers agree
      // that a diagonal-away player (NE/NW, fy≈0.71) shows no face to the camera.
      ctx.fillStyle = "#c49b74";
      ctx.beginPath(); ctx.arc(head.x + sfx * headR * 0.72, head.y + sfy * headR * 0.55, 1.25 * sc, 0, Math.PI * 2); ctx.fill();
    }
  }

  if (card) { ctx.fillStyle = card === "red" ? "#e0322f" : "#f2c531"; ctx.fillRect(head.x + headR * 0.7, head.y - headR * 1.6, 3 * sc, 4.2 * sc); }
}

function drawFallen(ctx: CanvasRenderingContext2D, sx: number, sy: number, sc: number, col: string) {
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(-1.15); // tipped onto the turf
  const dark = col === AWAY ? "#0a2740" : "#132a10";
  seg(ctx, 0, -3 * sc, 0, -15 * sc, 5 * sc, col);     // torso, laid down
  seg(ctx, 0, -6 * sc, 8 * sc, -3 * sc, 2.4 * sc, dark);  // splayed legs
  seg(ctx, 0, -6 * sc, 9 * sc, -9 * sc, 2.4 * sc, dark);
  seg(ctx, 0, -13 * sc, 6 * sc, -16 * sc, 2 * sc, dark);  // arm out
  ctx.fillStyle = SKIN; ctx.beginPath(); ctx.arc(0, -18 * sc, 4.2 * sc, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawBall(ctx: CanvasRenderingContext2D, ball: Pt & { z?: number }, trail: Pt[]) {
  trail.slice(1).forEach((t, i) => { const q = proj(t.x, t.y); ctx.fillStyle = `rgba(255,255,255,${0.16 * (1 - i / trail.length)})`; ctx.beginPath(); ctx.arc(q.sx, q.sy, 3, 0, Math.PI * 2); ctx.fill(); });
  const { sx, sy, s } = proj(ball.x, ball.y);
  const r = Math.max(4, 5 * s);
  const z = ball.z ?? 0;
  const lift = z * s * 2.2; // screen-pixels of height (perspective-scaled)
  const shf = Math.max(0.35, Math.min(1, 1 - z / 14)); // shadow shrinks + fades as it climbs
  // shadow stays on the GROUND at the ball's x/y
  ctx.fillStyle = `rgba(0,0,0,${0.4 * shf})`; ctx.beginPath(); ctx.ellipse(sx, sy + r * 0.5, r * 1.1 * shf, r * 0.5 * shf, 0, 0, Math.PI * 2); ctx.fill();
  // the ball, lifted by its height (and a touch bigger up high)
  const by = sy - r * 0.4 - lift;
  const br = r * (1 + z * 0.02);
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(sx, by, br, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#10160f"; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = "#1b241a"; ctx.beginPath(); ctx.arc(sx - br * 0.15, by - br * 0.1, br * 0.28, 0, Math.PI * 2); ctx.fill();
}
