"use client";

// PROTOTYPE (v2, /subtests2 only) — procedural / IK player bodies, à la Rain World.
//
// Same match engine and props as the v1 pitch (createMatchSim + snapshot), but the
// field, players and ball are drawn on a CANVAS with little spring-skeletons instead
// of billboard dot-tokens. Each body is driven purely by the sim's authoritative
// position + a velocity DERIVED here by finite difference (no change to match-sim):
//   velocity → facing / stride / lean,  speed → gait cadence,  acceleration → torso lean.
// Legs FOOT-PLANT in field space (feet stick to the pitch, the body glides over them,
// 2-bone analytic IK bends the knees), arms swing for balance, the torso bobs & leans.
// This layer is 100% COSMETIC and read-only — it never feeds the sim (per the spike's
// integer-authority rule). Charming first pass; foot-lock/ragdoll polish is the next step.
//
// Coords: x = width 0..100, y = length 0..100 (0 = near/bottom, 100 = far/top).

import { useEffect, useMemo, useRef, useState } from "react";
import { FlagIcon } from "@/components/live/bf-ui";
import type { Team } from "@/lib/subs-draft/engine";
import { fieldLayout, type FieldSlot, type Lineup } from "@/lib/subs-draft/squad";
import { createMatchSim, type MatchSim } from "@/lib/subs-draft/match-sim";
import type { MatchEvent } from "@/lib/subs-draft/tournament";

const HOME = "#c8ff2d";
const AWAY = "#5fb0ff";
const GK = "#f2a93b";
const MONO = "var(--font-jb, ui-monospace)";
const DISP = "var(--font-bric, system-ui)";

// canvas internal resolution + pseudo-3D projection tuning
const W = 760;
const H = 600;
const NEAR_Y = H * 0.95;
const FAR_Y = H * 0.11;
const NEAR_HW = W * 0.475;
const FAR_HW = W * 0.27;
const NEAR_S = 1.18;
const FAR_S = 0.5;

interface Pt { x: number; y: number }
interface Skel {
  feet: [Pt, Pt];   // field-space foot positions (planted stick to the ground)
  swing: number;    // -1 none, else index of swinging foot
  swingT: number;   // 0..1 swing progress
  target: Pt;       // swing destination (field)
  vx: number; vy: number; // smoothed velocity (field u/s)
  ax: number; ay: number; // smoothed accel
  gait: number;     // continuous phase for arm-swing / bob
  lean: number;     // smoothed horizontal lean (screen px)
}

function proj(fx: number, fy: number) {
  const t = fy / 100; // 0 near .. 1 far
  const sy = NEAR_Y + (FAR_Y - NEAR_Y) * t;
  const hw = NEAR_HW + (FAR_HW - NEAR_HW) * t;
  const sx = W / 2 + (fx / 100 - 0.5) * 2 * hw;
  const s = NEAR_S + (FAR_S - NEAR_S) * t;
  return { sx, sy, s };
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export default function PitchView({
  home, away, homeLineup, awayLineup, homeCode, awayCode, events, clock, playing,
}: {
  home: Team; away: Team; homeLineup: Lineup; awayLineup: Lineup;
  homeCode: string; awayCode: string; events: MatchEvent[]; clock: number; playing: boolean;
}) {
  const homeXI = useMemo(() => fieldLayout(home, homeLineup, "home"), [home, homeLineup]);
  const awayXI = useMemo(() => fieldLayout(away, awayLineup, "away"), [away, awayLineup]);
  const goals = useMemo(() => events.filter((e) => e.type === "goal"), [events]);

  const [caption, setCaption] = useState<string | null>(null);
  const [stats, setStats] = useState<{ possHome: number; shots: { home: number; away: number } }>({ possHome: 0.5, shots: { home: 0, away: 0 } });
  const [ticker, setTicker] = useState<{ min: number; text: string }[]>([]);
  const [cardFlash, setCardFlash] = useState<{ type: "yellow" | "red"; id: number } | null>(null);
  const [flash, setFlash] = useState<{ teamId: string; scorer: string } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const simRef = useRef<MatchSim | null>(null);
  const lastTs = useRef(0);
  const progressRef = useRef(0);
  const celebrated = useRef(goals.filter((e) => e.minute <= clock).length);
  const bookingsSig = useRef("");
  const eventSeqRef = useRef(0);
  const sentOffRef = useRef<Set<string>>(new Set());
  const trailRef = useRef<Pt[]>([]);
  const prevRef = useRef<{ home: Pt[]; away: Pt[] } | null>(null);
  const bookRef = useRef<Record<string, "yellow" | "red">>({});
  useEffect(() => { progressRef.current = clock / 90; }, [clock]);

  // one skeleton per XI slot (feet start at the formation anchor)
  const skels = useRef<{ home: Skel[]; away: Skel[] }>({ home: [], away: [] });
  useEffect(() => {
    const mk = (xi: FieldSlot[]): Skel[] => xi.map((a) => ({
      feet: [{ x: a.x - 1.4, y: a.y }, { x: a.x + 1.4, y: a.y }], swing: -1, swingT: 0,
      target: { x: a.x, y: a.y }, vx: 0, vy: 0, ax: 0, ay: 0, gait: Math.random() * 6.28, lean: 0,
    }));
    skels.current = { home: mk(homeXI), away: mk(awayXI) };
    prevRef.current = null;
    simRef.current = createMatchSim(homeXI, awayXI);
  }, [homeXI, awayXI]);

  // goal events → scripted shot + GOOOL flash
  useEffect(() => {
    const crossed = goals.filter((e) => e.minute <= clock).length;
    if (crossed > celebrated.current) {
      const e = goals.filter((ev) => ev.minute <= clock)[crossed - 1];
      celebrated.current = crossed;
      simRef.current?.scoreFor(e.teamId === home.id ? "home" : "away");
      setFlash({ teamId: e.teamId, scorer: e.player });
      const t = setTimeout(() => setFlash(null), 1500);
      return () => clearTimeout(t);
    }
    if (crossed < celebrated.current) celebrated.current = crossed;
  }, [clock, goals, home.id]);

  // step the sim, drive the skeletons, draw
  useEffect(() => {
    if (!playing) return;
    const ctx = canvasRef.current?.getContext("2d");
    let raf = 0;
    const frame = (ts: number) => {
      const dt = Math.min(0.05, (ts - (lastTs.current || ts)) / 1000);
      lastTs.current = ts;
      const sim = simRef.current;
      if (sim && ctx) {
        sim.step(dt, progressRef.current);
        const snap = sim.snapshot();

        // overlay state (throttled to changes)
        setCaption((c) => (snap.caption !== c ? snap.caption : c));
        setStats((s) => (s.possHome !== snap.possHome || s.shots.home !== snap.shots.home || s.shots.away !== snap.shots.away ? { possHome: snap.possHome, shots: snap.shots } : s));
        const sig = Object.entries(snap.bookings).map(([k, v]) => k + v).join(",");
        if (sig !== bookingsSig.current) { bookingsSig.current = sig; bookRef.current = snap.bookings; }
        if (snap.sentOff.length !== sentOffRef.current.size) { sentOffRef.current = new Set(snap.sentOff); }
        if (snap.eventSeq !== eventSeqRef.current) {
          eventSeqRef.current = snap.eventSeq;
          const min = Math.round(progressRef.current * 90);
          setTicker((t) => [{ min, text: snap.eventText }, ...t].slice(0, 6));
          if (/Vermelho|Amarelo/.test(snap.eventText)) {
            const id = snap.eventSeq;
            const type = /Vermelho/.test(snap.eventText) ? "red" : "yellow";
            setCardFlash({ type, id });
            setTimeout(() => setCardFlash((cf) => (cf?.id === id ? null : cf)), 1700);
          }
        }

        // velocity by finite difference vs previous frame
        const prev = prevRef.current;
        const invDt = dt > 0.0001 ? 1 / dt : 0;
        const upd = (cur: Pt[], pv: Pt[] | undefined, sk: Skel[]) => {
          cur.forEach((p, i) => {
            const s = sk[i];
            if (!s) return;
            const q = pv?.[i];
            let vx = 0, vy = 0;
            if (q) { vx = (p.x - q.x) * invDt; vy = (p.y - q.y) * invDt; }
            const teleport = q ? Math.hypot(p.x - q.x, p.y - q.y) > 8 : false;
            if (teleport) { // kickoff / goal reset → reseat feet, no phantom sprint
              s.feet = [{ x: p.x - 1.4, y: p.y }, { x: p.x + 1.4, y: p.y }];
              s.vx = 0; s.vy = 0; s.swing = -1;
              return;
            }
            const nax = (vx - s.vx) * invDt, nay = (vy - s.vy) * invDt;
            s.ax += (nax - s.ax) * 0.2; s.ay += (nay - s.ay) * 0.2;
            s.vx += (vx - s.vx) * 0.35; s.vy += (vy - s.vy) * 0.35;
            stepGait(s, p, dt);
          });
        };
        upd(snap.home, prev?.home, skels.current.home);
        upd(snap.away, prev?.away, skels.current.away);
        prevRef.current = { home: snap.home.map((p) => ({ ...p })), away: snap.away.map((p) => ({ ...p })) };

        // ball trail
        trailRef.current = [{ ...snap.ball }, ...trailRef.current].slice(0, 7);

        draw(ctx, {
          homeXI, awayXI, homePos: snap.home, awayPos: snap.away, ball: snap.ball,
          homeSkel: skels.current.home, awaySkel: skels.current.away,
          bookings: bookRef.current, sentOff: sentOffRef.current, trail: trailRef.current,
        });
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [playing, homeXI, awayXI]);

  const hg = goals.filter((e) => e.teamId === home.id && e.minute <= clock).length;
  const ag = goals.filter((e) => e.teamId === away.id && e.minute <= clock).length;

  return (
    <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", border: "1px solid rgba(200,255,45,0.18)", background: "#06140b" }}>
      <div style={{ position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)", zIndex: 5, display: "flex", alignItems: "center", gap: 12, background: "rgba(0,0,0,0.55)", padding: "6px 14px", borderRadius: 999 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: MONO, fontSize: 13, color: HOME }}><FlagIcon code={homeCode} size={13} /> {homeCode}</span>
        <span style={{ fontFamily: DISP, fontSize: 20, fontWeight: 800, color: "#fff" }}>{hg} <span style={{ color: "#6f7d73" }}>×</span> {ag}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: MONO, fontSize: 13, color: AWAY }}>{awayCode} <FlagIcon code={awayCode} size={13} /></span>
        <span style={{ fontFamily: MONO, fontSize: 12, color: "#9fb0a4", marginLeft: 4 }}>{Math.round(clock)}&apos;</span>
      </div>

      {caption && (
        <div style={{ position: "absolute", top: 44, left: "50%", transform: "translateX(-50%)", zIndex: 5, fontFamily: DISP, fontSize: 15, fontWeight: 800, letterSpacing: 0.5, color: "#ffe27a", textShadow: "0 2px 8px rgba(0,0,0,0.7)", pointerEvents: "none" }}>{caption}</div>
      )}
      {ticker.length > 0 && (
        <div style={{ position: "absolute", top: 10, left: 12, zIndex: 5, display: "grid", gap: 2, pointerEvents: "none" }}>
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

/* ─────────────── gait: foot-planting in field space ─────────────── */

function stepGait(s: Skel, p: Pt, dt: number) {
  const speed = Math.hypot(s.vx, s.vy);
  let dx = s.vx, dy = s.vy;
  if (speed > 0.4) { dx /= speed; dy /= speed; } else { dx = 0; dy = 1; } // facing "up" when idle
  const perp = { x: -dy, y: dx };
  const stance = 1.5;
  const homeL = { x: p.x + perp.x * -stance, y: p.y + perp.y * -stance };
  const homeR = { x: p.x + perp.x * stance, y: p.y + perp.y * stance };

  if (speed < 1.0) {
    // idle: drift feet back to a settled stance
    s.feet[0].x += (homeL.x - s.feet[0].x) * Math.min(1, dt * 5);
    s.feet[0].y += (homeL.y - s.feet[0].y) * Math.min(1, dt * 5);
    s.feet[1].x += (homeR.x - s.feet[1].x) * Math.min(1, dt * 5);
    s.feet[1].y += (homeR.y - s.feet[1].y) * Math.min(1, dt * 5);
    s.swing = -1;
  } else {
    const stride = clamp(speed * 0.16, 1.2, 3.4); // longer strides when faster
    if (s.swing < 0) {
      // step the foot that has fallen furthest behind the body along the run
      const behind = (f: Pt) => (p.x - f.x) * dx + (p.y - f.y) * dy;
      const b0 = behind(s.feet[0]), b1 = behind(s.feet[1]);
      const worst = b0 > b1 ? 0 : 1;
      if (Math.max(b0, b1) > stride * 0.85) {
        s.swing = worst;
        s.swingT = 0;
        const stanceOff = worst === 0 ? -stance : stance;
        s.target = { x: p.x + dx * stride + perp.x * stanceOff, y: p.y + dy * stride + perp.y * stanceOff };
      }
    }
    if (s.swing >= 0) {
      const f = s.feet[s.swing];
      const k = Math.min(1, dt * 16);
      f.x += (s.target.x - f.x) * k;
      f.y += (s.target.y - f.y) * k;
      s.swingT = Math.min(1, s.swingT + dt / clamp(0.32 - speed * 0.006, 0.14, 0.3));
      if (s.swingT >= 1) s.swing = -1;
    }
    // planted foot: left untouched → sticks to the ground while the body glides over it
  }

  // continuous phase for arm swing + bob; lean from horizontal acceleration
  s.gait += dt * (2.4 + Math.min(speed, 14) * 0.5);
  const projVx = proj(p.x + s.vx * 0.02, p.y).sx - proj(p.x, p.y).sx; // screen-x of velocity
  s.lean += (clamp(projVx * 2.4, -7, 7) - s.lean) * Math.min(1, dt * 6);
}

/* ─────────────── drawing ─────────────── */

interface DrawArgs {
  homeXI: FieldSlot[]; awayXI: FieldSlot[];
  homePos: Pt[]; awayPos: Pt[]; ball: Pt;
  homeSkel: Skel[]; awaySkel: Skel[];
  bookings: Record<string, "yellow" | "red">; sentOff: Set<string>; trail: Pt[];
}

function draw(ctx: CanvasRenderingContext2D, a: DrawArgs) {
  drawField(ctx);

  type Body = { fy: number; kind: "player" | "ball"; render: () => void };
  const bodies: Body[] = [];

  const push = (xi: FieldSlot[], pos: Pt[], sk: Skel[], base: string) => {
    xi.forEach((slot, i) => {
      if (a.sentOff.has(slot.id)) return;
      const p = pos[i];
      const s = sk[i];
      if (!p || !s) return;
      const col = slot.role === "Goleiro" ? GK : base;
      bodies.push({ fy: p.y, kind: "player", render: () => drawPlayer(ctx, p, s, col, a.bookings[slot.id]) });
    });
  };
  push(a.homeXI, a.homePos, a.homeSkel, HOME);
  push(a.awayXI, a.awayPos, a.awaySkel, AWAY);
  bodies.push({ fy: a.ball.y, kind: "ball", render: () => drawBall(ctx, a.ball, a.trail) });

  bodies.sort((x, y) => y.fy - x.fy); // far (high y) first, near last
  for (const b of bodies) b.render();
}

function drawField(ctx: CanvasRenderingContext2D) {
  ctx.clearRect(0, 0, W, H);
  // grass with mown stripes (perspective trapezoids)
  for (let i = 0; i < 10; i++) {
    const y0 = i * 10, y1 = y0 + 10;
    const a0 = proj(0, y0), b0 = proj(100, y0), b1 = proj(100, y1), a1 = proj(0, y1);
    ctx.beginPath();
    ctx.moveTo(a0.sx, a0.sy); ctx.lineTo(b0.sx, b0.sy); ctx.lineTo(b1.sx, b1.sy); ctx.lineTo(a1.sx, a1.sy); ctx.closePath();
    ctx.fillStyle = i % 2 ? "#1c8139" : "#1a7635";
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 1.6;
  const poly = (pts: number[][], close = true) => {
    ctx.beginPath();
    pts.forEach(([fx, fy], i) => { const q = proj(fx, fy); if (i === 0) ctx.moveTo(q.sx, q.sy); else ctx.lineTo(q.sx, q.sy); });
    if (close) ctx.closePath();
    ctx.stroke();
  };
  poly([[3, 3], [97, 3], [97, 97], [3, 97]]);            // boundary
  poly([[3, 50], [97, 50]], false);                      // halfway
  poly([[26, 3], [74, 3], [74, 15], [26, 15]]);          // near box
  poly([[26, 97], [74, 97], [74, 85], [26, 85]]);        // far box
  poly([[42, 3], [58, 3], [58, 7], [42, 7]]);            // near goal
  poly([[42, 97], [58, 97], [58, 93], [42, 93]]);        // far goal
  // centre circle (projected polygon)
  const circle: number[][] = [];
  for (let k = 0; k <= 24; k++) { const t = (k / 24) * Math.PI * 2; circle.push([50 + Math.cos(t) * 11, 50 + Math.sin(t) * 8]); }
  poly(circle, false);
}

function limb(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, w: number, col: string) {
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
}

// 2-bone analytic IK: knee between hip and foot, bent to `side`
function ikLeg(ctx: CanvasRenderingContext2D, hx: number, hy: number, fx: number, fy: number, thigh: number, shin: number, side: number, w: number, col: string) {
  const dx = fx - hx, dy = fy - hy;
  let d = Math.hypot(dx, dy);
  d = clamp(d, Math.abs(thigh - shin) + 0.3, thigh + shin - 0.3);
  const base = Math.atan2(dy, dx);
  const cosA = clamp((thigh * thigh + d * d - shin * shin) / (2 * thigh * d), -1, 1);
  const ang = base + side * Math.acos(cosA);
  const kx = hx + Math.cos(ang) * thigh, ky = hy + Math.sin(ang) * thigh;
  limb(ctx, hx, hy, kx, ky, w, col);
  limb(ctx, kx, ky, fx, fy, w, col);
}

function drawPlayer(ctx: CanvasRenderingContext2D, p: Pt, s: Skel, col: string, card?: "yellow" | "red") {
  const { sx, sy, s: scale } = proj(p.x, p.y);
  const legLen = 16 * scale, thigh = legLen * 0.52, shin = legLen * 0.52;
  const torso = 15 * scale, headR = 4.6 * scale, armLen = 12 * scale, lw = 2.6 * scale;
  const speed = Math.hypot(s.vx, s.vy);
  const bob = speed > 1 ? Math.abs(Math.sin(s.gait)) * 1.6 * scale : 0;
  const hip = { x: sx, y: sy - legLen - bob };
  const sho = { x: hip.x + s.lean * scale, y: hip.y - torso };
  const head = { x: sho.x + s.lean * scale * 0.4, y: sho.y - headR - 1 };

  // ground shadow
  ctx.fillStyle = "rgba(0,0,0,0.32)";
  ctx.beginPath(); ctx.ellipse(sx, sy, 8 * scale, 3.2 * scale, 0, 0, Math.PI * 2); ctx.fill();

  const dark = col === AWAY ? "#0a2740" : "#123";
  // feet (screen), swinging foot lifts on a sine arc
  const foot = (i: number) => {
    const f = proj(s.feet[i].x, s.feet[i].y);
    const lift = s.swing === i ? Math.sin(Math.PI * s.swingT) * legLen * 0.5 : 0;
    return { x: f.sx, y: f.sy - lift };
  };
  const f0 = foot(0), f1 = foot(1);
  // back leg first (screen-lower foot = nearer, drawn 2nd)
  const legs: [{ x: number; y: number }, number][] = f0.y <= f1.y ? [[f0, 0], [f1, 1]] : [[f1, 1], [f0, 0]];
  for (const [f] of legs) ikLeg(ctx, hip.x, hip.y, f.x, f.y, thigh, shin, s.lean >= 0 ? 1 : -1, lw, dark);

  // arms swing opposite, from shoulder
  const swingA = Math.sin(s.gait) * (0.5 + Math.min(speed, 12) * 0.05);
  for (const sgn of [1, -1]) {
    const hx = sho.x + sgn * headR * 0.7;
    const hand = { x: hx + Math.sin(s.gait + (sgn > 0 ? 0 : Math.PI)) * armLen * 0.7 + s.lean * scale * 0.3, y: sho.y + armLen * (0.7 + 0.3 * Math.cos(swingA)) };
    limb(ctx, hx, sho.y + 1, hand.x, hand.y, lw * 0.8, dark);
    ctx.fillStyle = "#e8d4b0"; ctx.beginPath(); ctx.arc(hand.x, hand.y, 1.5 * scale, 0, Math.PI * 2); ctx.fill(); // hand
  }

  // torso + head
  limb(ctx, hip.x, hip.y, sho.x, sho.y, lw * 1.9, col);
  ctx.fillStyle = "#e8d4b0"; ctx.beginPath(); ctx.arc(head.x, head.y, headR, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = dark; ctx.lineWidth = 1 * scale; ctx.stroke();

  if (card) {
    ctx.fillStyle = card === "red" ? "#e0322f" : "#f2c531";
    ctx.fillRect(head.x + headR * 0.6, head.y - headR * 1.5, 3 * scale, 4.2 * scale);
  }
}

function drawBall(ctx: CanvasRenderingContext2D, ball: Pt, trail: Pt[]) {
  trail.slice(1).forEach((t, i) => {
    const q = proj(t.x, t.y);
    ctx.fillStyle = `rgba(255,255,255,${0.16 * (1 - i / trail.length)})`;
    ctx.beginPath(); ctx.arc(q.sx, q.sy, 3, 0, Math.PI * 2); ctx.fill();
  });
  const { sx, sy, s } = proj(ball.x, ball.y);
  const r = Math.max(4, 5 * s);
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath(); ctx.ellipse(sx, sy + r * 0.5, r * 1.1, r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.arc(sx, sy - r * 0.4, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#10160f"; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = "#1b241a";
  ctx.beginPath(); ctx.arc(sx - r * 0.15, sy - r * 0.5, r * 0.28, 0, Math.PI * 2); ctx.fill();
}
