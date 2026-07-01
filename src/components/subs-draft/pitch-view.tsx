"use client";

// A pseudo-3D pitch for the spotlighted match: the field is tilted back in
// perspective, the two STARTING XIs stand up as billboards (counter-rotated tokens
// with a ground shadow) in their formation shape, and they drift toward a ball that
// wanders the pitch. Goal events snap the ball to the net + flash GOAL!; cards and
// injuries pop a badge on the player. Purely cosmetic — the result comes from
// tournament.ts; this just makes a "live" match watchable.
//
// Coords: x = width 0..100, y = length 0..100 (0 = near goal, 100 = far). Home
// attacks UP (y→100), away DOWN (y→0).

import { useEffect, useMemo, useRef, useState } from "react";
import { FlagIcon } from "@/components/live/bf-ui";
import type { Team } from "@/lib/subs-draft/engine";
import { fieldLayout, type FieldSlot, type Lineup } from "@/lib/subs-draft/squad";
import { createMatchSim, type MatchSim } from "@/lib/subs-draft/match-sim";
import type { MatchEvent } from "@/lib/subs-draft/tournament";

const HOME_COLOR = "#c8ff2d";
const AWAY_COLOR = "#5fb0ff";
const GK_COLOR = "#f2a93b";
const MONO = "var(--font-jb, ui-monospace)";
const DISP = "var(--font-bric, system-ui)";
const TILT = 56; // pitch rake in degrees

interface Pt { x: number; y: number }

export default function PitchView({
  home, away, homeLineup, awayLineup, homeCode, awayCode, events, clock, playing,
}: {
  home: Team;
  away: Team;
  homeLineup: Lineup;
  awayLineup: Lineup;
  homeCode: string;
  awayCode: string;
  events: MatchEvent[];
  clock: number;
  playing: boolean;
}) {
  const homeXI = useMemo(() => fieldLayout(home, homeLineup, "home"), [home, homeLineup]);
  const awayXI = useMemo(() => fieldLayout(away, awayLineup, "away"), [away, awayLineup]);
  const goals = useMemo(() => events.filter((e) => e.type === "goal"), [events]);

  const [homePos, setHomePos] = useState<Pt[]>(() => homeXI.map((a) => ({ x: a.x, y: a.y })));
  const [awayPos, setAwayPos] = useState<Pt[]>(() => awayXI.map((a) => ({ x: a.x, y: a.y })));
  const [ball, setBall] = useState<Pt>({ x: 50, y: 50 });
  const [ballTrail, setBallTrail] = useState<Pt[]>([]);
  const [caption, setCaption] = useState<string | null>(null);
  const [stats, setStats] = useState<{ possHome: number; shots: { home: number; away: number } }>({ possHome: 0.5, shots: { home: 0, away: 0 } });
  const [bookings, setBookings] = useState<Record<string, "yellow" | "red">>({});
  const [ticker, setTicker] = useState<{ min: number; text: string }[]>([]);
  const [sentOff, setSentOff] = useState<string[]>([]);
  const [cardFlash, setCardFlash] = useState<{ type: "yellow" | "red"; id: number } | null>(null);
  const [flash, setFlash] = useState<{ teamId: string; scorer: string } | null>(null);
  const progressRef = useRef(0);
  const bookingsSig = useRef("");
  const eventSeqRef = useRef(0);
  const sentOffCount = useRef(0);
  useEffect(() => { progressRef.current = clock / 90; }, [clock]);

  const simRef = useRef<MatchSim | null>(null);
  const lastTs = useRef(0);
  const celebrated = useRef(goals.filter((e) => e.minute <= clock).length);

  // Goal events → scripted shot on target + flash, as the clock crosses each one.
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

  // Build the possession sim when the XIs change (once per spotlighted match). Its
  // initial positions equal the formation anchors, so the first rAF frame syncs
  // without a visible jump.
  useEffect(() => {
    simRef.current = createMatchSim(homeXI, awayXI);
  }, [homeXI, awayXI]);

  // Movement loop — step the sim and render its snapshot.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const frame = (ts: number) => {
      const dt = Math.min(0.05, (ts - (lastTs.current || ts)) / 1000);
      lastTs.current = ts;
      const sim = simRef.current;
      if (sim) {
        sim.step(dt, progressRef.current);
        const snap = sim.snapshot();
        setHomePos(snap.home);
        setAwayPos(snap.away);
        setBall(snap.ball);
        setBallTrail((t) => [{ ...snap.ball }, ...t].slice(0, 6));
        setCaption((c) => (snap.caption !== c ? snap.caption : c));
        setStats((s) => (s.possHome !== snap.possHome || s.shots.home !== snap.shots.home || s.shots.away !== snap.shots.away ? { possHome: snap.possHome, shots: snap.shots } : s));
        const sig = Object.entries(snap.bookings).map(([k, v]) => k + v).join(",");
        if (sig !== bookingsSig.current) { bookingsSig.current = sig; setBookings(snap.bookings); }
        if (snap.sentOff.length !== sentOffCount.current) { sentOffCount.current = snap.sentOff.length; setSentOff(snap.sentOff); }
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
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const hg = goals.filter((e) => e.teamId === home.id && e.minute <= clock).length;
  const ag = goals.filter((e) => e.teamId === away.id && e.minute <= clock).length;

  // crossed card / injury badges by player
  const badge = useMemo(() => {
    const m: Record<string, string> = {};
    for (const e of events) {
      if (e.minute > clock) continue;
      if (e.type === "red") m[e.playerId] = "🟥";
      else if (e.type === "yellow") m[e.playerId] = m[e.playerId] === "🟥" ? "🟥" : "🟨";
      else if (e.type === "injury" && m[e.playerId] !== "🟥") m[e.playerId] = "🚑";
    }
    return m;
  }, [events, clock]);

  return (
    <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", border: "1px solid rgba(200,255,45,0.18)", background: "#06140b" }}>
      <div style={{ position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)", zIndex: 5, display: "flex", alignItems: "center", gap: 12, background: "rgba(0,0,0,0.55)", padding: "6px 14px", borderRadius: 999 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: MONO, fontSize: 13, color: HOME_COLOR }}><FlagIcon code={homeCode} size={13} /> {homeCode}</span>
        <span style={{ fontFamily: DISP, fontSize: 20, fontWeight: 800, color: "#fff" }}>{hg} <span style={{ color: "#6f7d73" }}>×</span> {ag}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: MONO, fontSize: 13, color: AWAY_COLOR }}>{awayCode} <FlagIcon code={awayCode} size={13} /></span>
        <span style={{ fontFamily: MONO, fontSize: 12, color: "#9fb0a4", marginLeft: 4 }}>{Math.round(clock)}&apos;</span>
      </div>

      {caption && (
        <div style={{ position: "absolute", top: 44, left: "50%", transform: "translateX(-50%)", zIndex: 5, fontFamily: DISP, fontSize: 15, fontWeight: 800, letterSpacing: 0.5, color: "#ffe27a", textShadow: "0 2px 8px rgba(0,0,0,0.7)", pointerEvents: "none" }}>
          {caption}
        </div>
      )}

      {/* events ticker */}
      {ticker.length > 0 && (
        <div style={{ position: "absolute", top: 10, left: 12, zIndex: 5, display: "grid", gap: 2, pointerEvents: "none" }}>
          {ticker.map((e, i) => (
            <div key={ticker.length - i + e.min} style={{ fontFamily: MONO, fontSize: 10.5, color: i === 0 ? "#e7f0e9" : "rgba(159,176,164,0.7)", textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>
              <span style={{ color: "#7e8f84" }}>{e.min}&apos;</span> {e.text}
            </div>
          ))}
        </div>
      )}

      <div style={{ perspective: 760, padding: "54px 10px 18px", display: "flex", justifyContent: "center" }}>
        <div style={{ position: "relative", width: "78%", maxWidth: 520, aspectRatio: "3 / 4", transform: `rotateX(${TILT}deg)`, transformStyle: "preserve-3d" }}>
          <Field />
          {homeXI.map((slot, i) => (sentOff.includes(slot.id) ? null : (
            <PlayerToken key={`h${i}`} pos={homePos[i] ?? slot} color={slot.role === "Goleiro" ? GK_COLOR : HOME_COLOR} ink="#0a120d" label={badge[slot.id] ?? roleLetter(slot)} card={bookings[slot.id]} />
          )))}
          {awayXI.map((slot, i) => (sentOff.includes(slot.id) ? null : (
            <PlayerToken key={`a${i}`} pos={awayPos[i] ?? slot} color={slot.role === "Goleiro" ? GK_COLOR : AWAY_COLOR} ink="#04121f" label={badge[slot.id] ?? roleLetter(slot)} card={bookings[slot.id]} />
          )))}
          {ballTrail.slice(1).map((p, i) => (
            <TrailDot key={`tr${i}`} pos={p} fade={1 - (i + 1) / (ballTrail.length + 1)} />
          ))}
          <BallToken pos={ball} />
        </div>
      </div>

      {/* possession + shots HUD */}
      <div style={{ position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)", zIndex: 5, width: "min(86%, 420px)", background: "rgba(0,0,0,0.5)", borderRadius: 10, padding: "7px 12px", backdropFilter: "blur(4px)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 10, color: "#9fb0a4", marginBottom: 4 }}>
          <span style={{ color: HOME_COLOR }}>{homeCode} · {Math.round(stats.possHome * 100)}%</span>
          <span>POSSE DE BOLA</span>
          <span style={{ color: AWAY_COLOR }}>{Math.round((1 - stats.possHome) * 100)}% · {awayCode}</span>
        </div>
        <div style={{ display: "flex", height: 6, borderRadius: 999, overflow: "hidden", background: "rgba(255,255,255,0.1)" }}>
          <div style={{ width: `${stats.possHome * 100}%`, background: HOME_COLOR }} />
          <div style={{ width: `${(1 - stats.possHome) * 100}%`, background: AWAY_COLOR }} />
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 5, fontFamily: MONO, fontSize: 11, color: "#dfe8e0" }}>
          <span style={{ color: HOME_COLOR, fontWeight: 700 }}>{stats.shots.home}</span>
          <span style={{ color: "#7e8f84" }}>⚽ chutes</span>
          <span style={{ color: AWAY_COLOR, fontWeight: 700 }}>{stats.shots.away}</span>
        </div>
      </div>

      {flash && (
        <div style={{ position: "absolute", inset: 0, zIndex: 6, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.35)", pointerEvents: "none" }}>
          <div style={{ fontFamily: DISP, fontSize: 52, fontWeight: 900, color: flash.teamId === home.id ? HOME_COLOR : AWAY_COLOR, textShadow: "0 4px 24px rgba(0,0,0,0.6)", animation: "subGoalPop 0.4s ease-out" }}>GOOOL!</div>
          <div style={{ fontFamily: MONO, fontSize: 14, color: "#fff", marginTop: 4 }}>{flash.scorer}</div>
        </div>
      )}
      {cardFlash && (
        <div style={{ position: "absolute", inset: 0, zIndex: 7, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)", pointerEvents: "none" }}>
          <div style={{ width: 50, height: 72, borderRadius: 6, background: cardFlash.type === "red" ? "#e0322f" : "#f2c531", boxShadow: `0 10px 34px ${cardFlash.type === "red" ? "rgba(224,50,47,0.5)" : "rgba(242,197,49,0.5)"}, 0 4px 10px rgba(0,0,0,0.6)`, transformOrigin: "bottom right", animation: "subCardPop 0.55s cubic-bezier(.2,1.5,.5,1)" }} />
          <div style={{ fontFamily: DISP, fontSize: 19, fontWeight: 800, letterSpacing: 0.5, color: "#fff", marginTop: 14, textShadow: "0 2px 8px rgba(0,0,0,0.7)" }}>
            {cardFlash.type === "red" ? "CARTÃO VERMELHO" : "CARTÃO AMARELO"}
          </div>
        </div>
      )}
      <style>{`@keyframes subGoalPop{0%{transform:scale(.6);opacity:0}60%{transform:scale(1.12);opacity:1}100%{transform:scale(1);opacity:1}}@keyframes subCardPop{0%{transform:rotate(-35deg) scale(.3);opacity:0}55%{transform:rotate(10deg) scale(1.12);opacity:1}100%{transform:rotate(0) scale(1);opacity:1}}`}</style>
    </div>
  );
}

function roleLetter(slot: FieldSlot): string {
  return slot.role === "Goleiro" ? "G" : slot.role === "Defensor" ? "Z" : slot.role === "Meio-campo" ? "M" : "A";
}

function Field() {
  return (
    <>
      <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(0deg, #1f8f3f 0 8.33%, #1b7e38 8.33% 16.66%)", borderRadius: 4 }} />
      <svg viewBox="0 0 100 133" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        <g fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.6">
          <rect x="3" y="3" width="94" height="127" />
          <line x1="3" y1="66.5" x2="97" y2="66.5" />
          <circle cx="50" cy="66.5" r="13" />
          <circle cx="50" cy="66.5" r="0.8" fill="rgba(255,255,255,0.6)" />
          <rect x="28" y="3" width="44" height="13" />
          <rect x="40" y="3" width="20" height="5" />
          <rect x="28" y="117" width="44" height="13" />
          <rect x="40" y="125" width="20" height="5" />
        </g>
      </svg>
    </>
  );
}

const depthScale = (topPct: number) => 0.62 + 0.5 * (topPct / 100);

function PlayerToken({ pos, color, ink, label, card }: { pos: Pt; color: string; ink: string; label: string; card?: "yellow" | "red" }) {
  const topPct = 100 - pos.y;
  const scale = depthScale(topPct);
  return (
    <div style={{ position: "absolute", left: `${pos.x}%`, top: `${topPct}%`, transformStyle: "preserve-3d" }}>
      <div style={{ position: "absolute", left: 0, top: 0, transform: "translate(-50%,-50%)", width: 11 * scale, height: 5 * scale, borderRadius: "50%", background: "rgba(0,0,0,0.32)" }} />
      <div style={{ position: "absolute", left: 0, top: 0, transformOrigin: "center bottom", transform: `translate(-50%,-100%) rotateX(-${TILT}deg) scale(${scale})`, width: 13, height: 17, borderRadius: 5, background: color, border: `1px solid ${ink}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: label.length > 1 ? 9 : 8, fontWeight: 800, color: ink, boxShadow: "0 2px 5px rgba(0,0,0,0.4)" }}>
        {label}
        {card && <span style={{ position: "absolute", top: -4, right: -4, width: 4.5, height: 6, borderRadius: 1, background: card === "red" ? "#e0322f" : "#f2c531", border: "0.5px solid rgba(0,0,0,0.5)" }} />}
      </div>
    </div>
  );
}

function TrailDot({ pos, fade }: { pos: Pt; fade: number }) {
  const topPct = 100 - pos.y;
  const scale = Math.max(0.55, depthScale(topPct));
  return (
    <div
      style={{
        position: "absolute", left: `${pos.x}%`, top: `${topPct}%`,
        transform: "translate(-50%,-50%)", width: 8 * scale, height: 8 * scale, borderRadius: "50%",
        background: "#fff", opacity: 0.22 * fade, filter: "blur(1px)", pointerEvents: "none",
      }}
    />
  );
}

function BallToken({ pos }: { pos: Pt }) {
  const topPct = 100 - pos.y;
  const scale = Math.max(0.72, depthScale(topPct)); // keep it legible even far away
  return (
    <div style={{ position: "absolute", left: `${pos.x}%`, top: `${topPct}%`, transformStyle: "preserve-3d", zIndex: 3 }}>
      {/* ground shadow */}
      <div style={{ position: "absolute", left: 0, top: 0, transform: "translate(-50%,-40%)", width: 11 * scale, height: 4.5 * scale, borderRadius: "50%", background: "rgba(0,0,0,0.4)" }} />
      {/* the ball — bigger, bright, glowing, with pentagon spots */}
      <div
        style={{
          position: "absolute", left: 0, top: 0, transformOrigin: "center bottom",
          transform: `translate(-50%,-95%) rotateX(-${TILT}deg) scale(${scale})`,
          width: 14, height: 14, borderRadius: "50%",
          background: "radial-gradient(circle at 34% 28%, #ffffff 38%, #e8ede8 60%, #b9c2b9 100%)",
          border: "1.5px solid #10160f",
          boxShadow: "0 0 7px 2px rgba(255,255,255,0.55), 0 3px 5px rgba(0,0,0,0.55)",
        }}
      >
        <span style={{ position: "absolute", top: "42%", left: "46%", width: 3.4, height: 3.4, borderRadius: "50%", background: "#1b241a", transform: "translate(-50%,-50%)" }} />
        <span style={{ position: "absolute", top: "24%", left: "72%", width: 2.2, height: 2.2, borderRadius: "50%", background: "#2a352a" }} />
        <span style={{ position: "absolute", top: "70%", left: "28%", width: 2, height: 2, borderRadius: "50%", background: "#2a352a" }} />
      </div>
    </div>
  );
}
