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
import { createMatchSim, type MatchSim } from "@/lib/subs-draft/match-sim";
import type { MatchEvent } from "@/lib/subs-draft/tournament";

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
interface Skel {
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
  const [style, setStyle] = useState<Style>("ik");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const simRef = useRef<MatchSim | null>(null);
  const lastTs = useRef(0);
  const progressRef = useRef(0);
  const styleRef = useRef<Style>("ik");
  const celebrated = useRef(goals.filter((e) => e.minute <= clock).length);
  const bookingsSig = useRef("");
  const eventSeqRef = useRef(0);
  const sentOffRef = useRef<Set<string>>(new Set());
  const bookRef = useRef<Record<string, "yellow" | "red">>({});
  const trailRef = useRef<Pt[]>([]);
  const prevRef = useRef<{ home: Pt[]; away: Pt[] } | null>(null);
  const prevBall = useRef<Pt | null>(null);
  const prevBallSpeed = useRef(0);
  const lastCap = useRef<string | null>(null);
  useEffect(() => { progressRef.current = clock / 90; }, [clock]);
  useEffect(() => { styleRef.current = style; }, [style]);

  const skels = useRef<{ home: Skel[]; away: Skel[] }>({ home: [], away: [] });
  useEffect(() => {
    const mk = (xi: FieldSlot[]): Skel[] => xi.map((a) => ({
      feet: [{ x: a.x - 1.1, y: a.y }, { x: a.x + 1.1, y: a.y }], swing: -1, swingT: 0, target: { x: a.x, y: a.y },
      vx: 0, vy: 0, ax: 0, ay: 0, gait: Math.random() * 6.28, lean: 0, kickT: 0, kx: 0, ky: 1, fall: 0,
    }));
    skels.current = { home: mk(homeXI), away: mk(awayXI) };
    prevRef.current = null; prevBall.current = null;
    simRef.current = createMatchSim(homeXI, awayXI);
  }, [homeXI, awayXI]);

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
        const invDt = dt > 0.0001 ? 1 / dt : 0;

        // overlay state
        setCaption((c) => (snap.caption !== c ? snap.caption : c));
        setStats((s) => (s.possHome !== snap.possHome || s.shots.home !== snap.shots.home || s.shots.away !== snap.shots.away ? { possHome: snap.possHome, shots: snap.shots } : s));
        const sig = Object.entries(snap.bookings).map(([k, v]) => k + v).join(",");
        if (sig !== bookingsSig.current) { bookingsSig.current = sig; bookRef.current = snap.bookings; }
        if (snap.sentOff.length !== sentOffRef.current.size) sentOffRef.current = new Set(snap.sentOff);
        if (snap.eventSeq !== eventSeqRef.current) {
          eventSeqRef.current = snap.eventSeq;
          setTicker((t) => [{ min: Math.round(progressRef.current * 90), text: snap.eventText }, ...t].slice(0, 6));
          if (/Vermelho|Amarelo/.test(snap.eventText)) {
            const id = snap.eventSeq;
            const type = /Vermelho/.test(snap.eventText) ? "red" : "yellow";
            setCardFlash({ type, id });
            setTimeout(() => setCardFlash((cf) => (cf?.id === id ? null : cf)), 1700);
          }
        }

        // ball velocity + kick / foul detection
        const bv = prevBall.current ? { x: (snap.ball.x - prevBall.current.x) * invDt, y: (snap.ball.y - prevBall.current.y) * invDt } : { x: 0, y: 0 };
        const bspeed = Math.hypot(bv.x, bv.y);
        const nearestToBall = () => {
          let best: Skel | null = null, bd = Infinity;
          const scan = (pos: Pt[], sk: Skel[]) => pos.forEach((p, i) => { const d = Math.hypot(p.x - snap.ball.x, p.y - snap.ball.y); if (d < bd) { bd = d; best = sk[i]; } });
          scan(snap.home, skels.current.home); scan(snap.away, skels.current.away);
          return { s: best as Skel | null, d: bd };
        };
        if (prevBallSpeed.current < 22 && bspeed > 34) { // a ball was just STRUCK
          const nb = nearestToBall();
          if (nb.s && nb.d < 3.2 && nb.s.fall <= 0) { const n = Math.max(1, bspeed); nb.s.kickT = 0.3; nb.s.kx = bv.x / n; nb.s.ky = bv.y / n; }
        }
        if (snap.caption === "Falta!" && lastCap.current !== "Falta!") { // a foul → ragdoll the nearest man
          const nb = nearestToBall();
          if (nb.s) nb.s.fall = 1.0;
        }
        lastCap.current = snap.caption;
        prevBall.current = { ...snap.ball };
        prevBallSpeed.current = bspeed;

        // per-player velocity + gait
        const prev = prevRef.current;
        const upd = (cur: Pt[], pv: Pt[] | undefined, sk: Skel[]) => {
          cur.forEach((p, i) => {
            const s = sk[i]; if (!s) return;
            const q = pv?.[i];
            let vx = 0, vy = 0;
            if (q) { vx = (p.x - q.x) * invDt; vy = (p.y - q.y) * invDt; }
            if (q && Math.hypot(p.x - q.x, p.y - q.y) > 8) { s.feet = [{ x: p.x - 1.1, y: p.y }, { x: p.x + 1.1, y: p.y }]; s.vx = 0; s.vy = 0; s.swing = -1; return; }
            const nax = (vx - s.vx) * invDt, nay = (vy - s.vy) * invDt;
            s.ax += (nax - s.ax) * 0.2; s.ay += (nay - s.ay) * 0.2;
            s.vx += (vx - s.vx) * 0.35; s.vy += (vy - s.vy) * 0.35;
            stepGait(s, p, dt);
          });
        };
        upd(snap.home, prev?.home, skels.current.home);
        upd(snap.away, prev?.away, skels.current.away);
        prevRef.current = { home: snap.home.map((p) => ({ ...p })), away: snap.away.map((p) => ({ ...p })) };

        trailRef.current = [{ ...snap.ball }, ...trailRef.current].slice(0, 7);
        draw(ctx, {
          homeXI, awayXI, homePos: snap.home, awayPos: snap.away, ball: snap.ball,
          homeSkel: skels.current.home, awaySkel: skels.current.away,
          bookings: bookRef.current, sentOff: sentOffRef.current, trail: trailRef.current, style: styleRef.current,
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

function stepGait(s: Skel, p: Pt, dt: number) {
  if (s.fall > 0) { s.fall -= dt; return; } // on the ground — freeze the gait
  const speed = Math.hypot(s.vx, s.vy);
  let dx = s.vx, dy = s.vy;
  if (speed > 0.4) { dx /= speed; dy /= speed; } else { dx = 0; dy = 1; }
  const perp = { x: -dy, y: dx };
  const stance = 1.05;
  const homeL = { x: p.x + perp.x * -stance, y: p.y + perp.y * -stance };
  const homeR = { x: p.x + perp.x * stance, y: p.y + perp.y * stance };

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
    const worst = b0 > b1 ? 0 : 1;
    // start a step when a foot has fallen behind, or FORCE one if it's dragging far
    if (s.swing < 0 && (Math.max(b0, b1) > stride * 0.7 || Math.max(b0, b1) > 3.2)) {
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
  homePos: Pt[]; awayPos: Pt[]; ball: Pt;
  homeSkel: Skel[]; awaySkel: Skel[];
  bookings: Record<string, "yellow" | "red">; sentOff: Set<string>; trail: Pt[]; style: Style;
}

function draw(ctx: CanvasRenderingContext2D, a: DrawArgs) {
  drawField(ctx);
  const bodies: { fy: number; render: () => void }[] = [];
  const push = (xi: FieldSlot[], pos: Pt[], sk: Skel[], base: string) => xi.forEach((slot, i) => {
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

function drawPlayer(ctx: CanvasRenderingContext2D, p: Pt, s: Skel, col: string, card: "yellow" | "red" | undefined, style: Style) {
  const { sx, sy, s: sc } = proj(p.x, p.y);
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
  const f0 = footScreen(s, 0, legLen), f1 = footScreen(s, 1, legLen);
  const legOrder: [{ x: number; y: number }, number][] = f0.y <= f1.y ? [[f0, 0], [f1, 1]] : [[f1, 1], [f0, 0]];

  if (style === "pixel") {
    // chunky RETRO body — jersey block, shorts, socks/boots, blocky limbs, head + hair
    const short = col === AWAY ? "#0e3a63" : "#20361a";
    const sock = "#101512";
    for (const [f] of legOrder) { ikLeg(ctx, hip.x, hip.y, f.x, f.y, thigh, shin, lw, sock); ctx.fillStyle = "#0b0d0a"; ctx.fillRect(Math.round(f.x - 2.4 * sc), Math.round(f.y - 1.6 * sc), 4.8 * sc, 2.6 * sc); }
    // shorts block
    ctx.fillStyle = short; ctx.fillRect(Math.round(hip.x - 4.4 * sc), Math.round(hip.y - 2 * sc), 8.8 * sc, 5 * sc);
    // arms
    const swing = Math.sin(s.gait) * (0.5 + Math.min(speed, 12) * 0.05);
    for (const sgn of [1, -1]) { const hx = sho.x + sgn * headR * 0.7; const hand = { x: hx + Math.sin(s.gait + (sgn > 0 ? 0 : Math.PI)) * arm * 0.6 + s.lean * sc * 0.3, y: sho.y + arm * (0.7 + 0.3 * Math.cos(swing)) }; seg(ctx, hx, sho.y + 1, hand.x, hand.y, lw * 0.9, col); ctx.fillStyle = SKIN; ctx.fillRect(Math.round(hand.x - 1.4 * sc), Math.round(hand.y - 1.4 * sc), 2.8 * sc, 2.8 * sc); }
    // jersey block
    ctx.fillStyle = col; ctx.fillRect(Math.round(hip.x - 4.6 * sc + s.lean * sc * 0.4), Math.round(sho.y - 1 * sc), 9.2 * sc, torso + 2 * sc);
    ctx.fillStyle = dark; ctx.fillRect(Math.round(hip.x - 4.6 * sc + s.lean * sc * 0.4), Math.round(sho.y - 1 * sc), 9.2 * sc, 1.4 * sc); // collar shade
    // head + hair
    ctx.fillStyle = SKIN; ctx.fillRect(Math.round(head.x - headR), Math.round(head.y - headR), headR * 2, headR * 2);
    ctx.fillStyle = "#3a2a1c"; ctx.fillRect(Math.round(head.x - headR), Math.round(head.y - headR), headR * 2, headR * 0.9);
  } else {
    // IK stick skeleton
    for (const [f] of legOrder) ikLeg(ctx, hip.x, hip.y, f.x, f.y, thigh, shin, lw, dark);
    const swing = Math.sin(s.gait) * (0.5 + Math.min(speed, 12) * 0.05);
    for (const sgn of [1, -1]) { const hx = sho.x + sgn * headR * 0.7; const hand = { x: hx + Math.sin(s.gait + (sgn > 0 ? 0 : Math.PI)) * arm * 0.7 + s.lean * sc * 0.3, y: sho.y + arm * (0.7 + 0.3 * Math.cos(swing)) }; seg(ctx, hx, sho.y + 1, hand.x, hand.y, lw * 0.8, dark); ctx.fillStyle = SKIN; ctx.beginPath(); ctx.arc(hand.x, hand.y, 1.5 * sc, 0, Math.PI * 2); ctx.fill(); }
    seg(ctx, hip.x, hip.y, sho.x, sho.y, lw * 1.9, col);
    ctx.fillStyle = SKIN; ctx.beginPath(); ctx.arc(head.x, head.y, headR, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = dark; ctx.lineWidth = sc; ctx.stroke();
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

function drawBall(ctx: CanvasRenderingContext2D, ball: Pt, trail: Pt[]) {
  trail.slice(1).forEach((t, i) => { const q = proj(t.x, t.y); ctx.fillStyle = `rgba(255,255,255,${0.16 * (1 - i / trail.length)})`; ctx.beginPath(); ctx.arc(q.sx, q.sy, 3, 0, Math.PI * 2); ctx.fill(); });
  const { sx, sy, s } = proj(ball.x, ball.y);
  const r = Math.max(4, 5 * s);
  ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.beginPath(); ctx.ellipse(sx, sy + r * 0.5, r * 1.1, r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(sx, sy - r * 0.4, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#10160f"; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = "#1b241a"; ctx.beginPath(); ctx.arc(sx - r * 0.15, sy - r * 0.5, r * 0.28, 0, Math.PI * 2); ctx.fill();
}
