"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { Countdown } from "@/components/countdown";
import { flagFileBase } from "@/lib/team-names";
import { ASSET_BASE, BRIC, SAIRA, JB, ARCHIVO } from "@/components/live/bf-ui";
import { MOCK_STATS, type Dossier, type Scenario, type ShowpieceTheme } from "@/lib/showpiece/dossiers";

/**
 * ShowpieceMatch — a fully-revamped, dramatic single-match view for the two
 * marquee fixtures (the final and the third-place match). Split-screen national
 * color fields, giant crests + team dossiers, a metal center column that shows a
 * live countdown (pre-match) or the live score, and a lower deck that switches
 * between the palpite predictor (pre) and the goal timeline + stats (live).
 *
 * Self-contained + mock-driven so it can be previewed on `/finais` before it's
 * wired into the real live view.
 */

// ---------------------------------------------------------------------------
// Keyframes — injected once (module-level guard, not per-render).
// ---------------------------------------------------------------------------

const KEYFRAMES = `
@keyframes spTitleSheen { 0% { background-position: -200% 0 } 100% { background-position: 200% 0 } }
@keyframes spGlowPulse { 0%,100% { opacity: .55; transform: scale(1) } 50% { opacity: 1; transform: scale(1.05) } }
@keyframes spRise { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }
@keyframes spFloat { 0% { transform: translateY(0) } 50% { transform: translateY(-9px) } 100% { transform: translateY(0) } }
@keyframes spWave { 0%,100% { transform: translateX(-3%) rotate(-1deg) } 50% { transform: translateX(3%) rotate(1deg) } }
@keyframes spLive { 0%,100% { opacity: 1; transform: scale(1) } 50% { opacity: .35; transform: scale(.8) } }
@keyframes spSweep { 0% { transform: translateX(-120%) } 100% { transform: translateX(320%) } }
@keyframes spDrift { 0% { transform: translateY(0) translateX(0); opacity: 0 } 10%,90% { opacity: .5 } 100% { transform: translateY(-120px) translateX(20px); opacity: 0 } }
@keyframes spBlink { 0%,49% { opacity: 1 } 50%,100% { opacity: 0 } }
@keyframes spChega { from { opacity: 0; transform: translateY(-10px) scale(.98) } to { opacity: 1; transform: none } }
`;

let injected = false;
export function ShowpieceStyles() {
  if (typeof document !== "undefined" && !injected) {
    const el = document.createElement("style");
    el.dataset.showpiece = "1";
    el.textContent = KEYFRAMES;
    document.head.appendChild(el);
    injected = true;
  }
  return null;
}

export const mono = (size: number, color: string, ls = "0.14em"): CSSProperties => ({ fontFamily: JB, fontSize: size, letterSpacing: ls, color, textTransform: "uppercase" });

// ---------------------------------------------------------------------------
// Giant crest — a big waving national flag with a metal ring + colored glow.
// ---------------------------------------------------------------------------

function BigCrest({ code, accent, size }: { code: string; accent: string; size: number }) {
  const base = flagFileBase(code);
  return (
    <div style={{ position: "relative", width: size, height: size, flex: "none", animation: "spFloat 7s ease-in-out infinite" }}>
      <div aria-hidden style={{ position: "absolute", inset: "-18%", borderRadius: "50%", background: `radial-gradient(circle, ${accent}55, transparent 66%)`, filter: "blur(6px)" }} />
      <div style={{ position: "absolute", inset: 0, borderRadius: "50%", overflow: "hidden", border: `3px solid ${accent}`, boxShadow: `0 0 42px -6px ${accent}, inset 0 0 30px rgba(0,0,0,0.45)` }}>
        {base ? (
          <div style={{ position: "absolute", inset: "-10%", animation: "spWave 5s ease-in-out infinite" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${ASSET_BASE}/flags/${base}.svg`} alt={code} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        ) : (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: ARCHIVO, fontWeight: 800, fontSize: size * 0.3, color: accent }}>{code}</div>
        )}
        <div aria-hidden style={{ position: "absolute", top: 0, bottom: 0, width: "40%", left: 0, background: "linear-gradient(100deg, transparent, rgba(255,255,255,0.45), transparent)", animation: "spSweep 6s linear infinite" }} />
      </div>
    </div>
  );
}

function StatChip({ label, value, accent }: { label: string; value: ReactNode; accent: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "8px 12px", borderRadius: 11, background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.09)", minWidth: 74 }}>
      <span style={mono(8.5, "rgba(255,255,255,0.5)", "0.1em")}>{label}</span>
      <span style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: 18, color: accent, lineHeight: 1 }}>{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Team half — a leaning national color field with crest + dossier.
// ---------------------------------------------------------------------------

function TeamHalf({ d, side, theme, narrow, compact }: { d: Dossier; side: "home" | "away"; theme: ShowpieceTheme; narrow: boolean; compact: boolean }) {
  const isHome = side === "home";
  const align = narrow ? "center" : isHome ? "flex-start" : "flex-end";
  const field = isHome
    ? `linear-gradient(105deg, ${d.primary}2e 0%, ${d.primary}12 46%, transparent 74%)`
    : `linear-gradient(255deg, ${d.primary}2e 0%, ${d.primary}12 46%, transparent 74%)`;
  const crest = narrow ? 112 : compact ? 84 : 150;
  const nameSize = narrow ? 38 : compact ? 30 : 56;
  return (
    <div style={{ position: "relative", flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: align, justifyContent: "center", gap: compact ? 8 : 16, padding: narrow ? "10px 14px" : compact ? "2px 26px" : "10px 30px", background: narrow ? "transparent" : field, animation: "spRise .6s ease both" }}>
      <div aria-hidden style={{ position: "absolute", top: narrow ? 6 : "50%", [isHome ? "left" : "right"]: 6, transform: narrow ? "none" : "translateY(-50%)", fontFamily: ARCHIVO, fontWeight: 900, fontSize: narrow ? 92 : compact ? 130 : 190, lineHeight: 0.8, color: d.primary, opacity: 0.09, letterSpacing: "-0.04em", pointerEvents: "none", userSelect: "none" }}>{d.code}</div>

      <BigCrest code={d.code} accent={d.primary} size={crest} />

      <div style={{ display: "flex", flexDirection: "column", alignItems: align, gap: 3, position: "relative" }}>
        <span style={mono(compact ? 9 : 10, d.primary, "0.2em")}>{d.nickname}</span>
        <span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: nameSize, lineHeight: 0.92, color: "#fff", letterSpacing: "-0.01em", textShadow: `0 3px 30px ${d.primary}66`, textAlign: isHome || narrow ? "left" : "right" }}>{d.name}</span>
        <span style={{ ...mono(9, "rgba(255,255,255,0.55)"), display: "inline-flex", gap: 8 }}>
          <span>FIFA #{d.fifaRank}</span><span style={{ color: d.primary }}>◆</span><span>TÉC. {d.coach}</span>
        </span>
      </div>

      {/* Star player */}
      <div style={{ display: "flex", alignItems: "center", gap: 11, padding: compact ? "6px 12px" : "9px 14px", borderRadius: 13, background: `linear-gradient(100deg, ${d.primary}33, ${d.primary}0d)`, border: `1px solid ${d.primary}55`, boxShadow: `0 10px 30px -16px ${d.primary}` }}>
        <span style={{ fontSize: compact ? 17 : 22, lineHeight: 1 }}>⭐</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <span style={mono(8, "rgba(255,255,255,0.55)", "0.16em")}>CRAQUE</span>
          <span style={{ fontFamily: BRIC, fontWeight: 700, fontSize: compact ? 15 : 17, color: "#fff", lineHeight: 1 }}>{d.star.name}</span>
          <span style={mono(8, d.primary, "0.1em")}>{d.star.pos}</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: compact ? 7 : 9, flexWrap: "wrap", justifyContent: narrow ? "center" : isHome ? "flex-start" : "flex-end" }}>
        <StatChip label="GOLS (MATA)" value={d.koGoalsFor} accent={d.primary} />
        <StatChip label="SOFRIDOS" value={d.koGoalsAgainst} accent="#ff8a8a" />
        <StatChip label="SALDO" value={`+${d.koGoalsFor - d.koGoalsAgainst}`} accent={theme.metal} />
      </div>

      {/* Tagline — dropped in the compact (embedded) layout to save height. */}
      {!compact && (
        <p style={{ margin: 0, fontFamily: BRIC, fontSize: 12.5, fontStyle: "italic", color: "rgba(255,255,255,0.62)", maxWidth: 260, textAlign: isHome || narrow ? "left" : "right" }}>&ldquo;{d.tagline}&rdquo;</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Center column — countdown (pre) or live score (live).
// ---------------------------------------------------------------------------

function fmtCountdown(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const s = Math.floor(ms / 1000);
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function MetalRing({ theme, size = 210, children }: { theme: ShowpieceTheme; size?: number; children: ReactNode }) {
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", width: size, height: size }}>
      <div aria-hidden style={{ position: "absolute", inset: 0, borderRadius: "50%", background: `radial-gradient(circle, ${theme.glow}, transparent 68%)`, animation: "spGlowPulse 3.4s ease-in-out infinite" }} />
      <div style={{ position: "absolute", inset: 14, borderRadius: "50%", border: `2px solid ${theme.metal}`, boxShadow: `0 0 30px -4px ${theme.glow}, inset 0 0 24px rgba(0,0,0,0.5)` }} />
      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>{children}</div>
    </div>
  );
}

function CenterColumn({ scenario, narrow, compact }: { scenario: Scenario; narrow: boolean; compact: boolean }) {
  const { match, theme, home, away } = scenario;
  const live = match.state === "in";
  const kickoffMs = new Date(match.startsAt).getTime();
  const scoreSize = compact ? 54 : 78;

  return (
    <div style={{ flex: narrow ? "none" : compact ? "0 0 210px" : "0 0 250px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: compact ? 9 : 14, padding: "6px 4px", position: "relative" }}>
      {/* vertical divider glow */}
      {!narrow && <div aria-hidden style={{ position: "absolute", top: 8, bottom: 8, left: "50%", width: 1, background: `linear-gradient(${theme.metal}00, ${theme.metal}66, ${theme.metal}00)` }} />}

      {live ? (
        <>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 12px", borderRadius: 999, background: "rgba(255,60,60,0.14)", border: "1px solid rgba(255,80,80,0.5)" }}>
            <span aria-hidden style={{ width: 8, height: 8, borderRadius: "50%", background: "#ff4d4d", boxShadow: "0 0 9px #ff4d4d", animation: "spLive 1.3s infinite" }} />
            <span style={mono(11, "#ff9a9a", "0.12em")}>AO VIVO · {match.displayClock}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: narrow ? 14 : 10 }}>
            <span style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: scoreSize, lineHeight: 1, color: home.primary, textShadow: `0 4px 34px ${home.primary}88` }}>{match.homeScore}</span>
            <span style={{ fontFamily: BRIC, fontWeight: 700, fontSize: compact ? 22 : 30, color: theme.metal, opacity: 0.8 }}>:</span>
            <span style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: scoreSize, lineHeight: 1, color: away.primary, textShadow: `0 4px 34px ${away.primary}88` }}>{match.awayScore}</span>
          </div>
          <span style={mono(9, "rgba(255,255,255,0.5)")}>{home.code} &nbsp;—&nbsp; {away.code}</span>
        </>
      ) : (
        <>
          <span style={mono(compact ? 9 : 10, theme.metal, "0.24em")}>COMEÇA EM</span>
          <MetalRing theme={theme} size={compact ? 138 : 210}>
            <span style={{ fontSize: compact ? 18 : 26 }}>{theme.trophy}</span>
            <Countdown targetMs={kickoffMs} render={(ms) => (
              <span style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: compact ? 24 : 34, letterSpacing: "0.02em", color: "#fff", lineHeight: 1, textShadow: `0 0 22px ${theme.glow}` }}>{fmtCountdown(ms)}</span>
            )} />
            <span style={mono(compact ? 7 : 8, "rgba(255,255,255,0.55)")}>HORAS : MIN : SEG</span>
          </MetalRing>
          <span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: compact ? 16 : 20, color: theme.metal, letterSpacing: "0.12em" }}>VS</span>
        </>
      )}

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, marginTop: compact ? 0 : 4 }}>
        <span style={mono(8.5, "rgba(255,255,255,0.42)")}>📍 {match.venue}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lower deck — palpite predictor (pre) / goal timeline + stats (live).
// ---------------------------------------------------------------------------

function Stepper({ value, onDelta, color }: { value: number; onDelta: (d: number) => void; color: string }) {
  const btn: CSSProperties = { width: 34, height: 34, borderRadius: 9, border: `1px solid ${color}66`, background: "rgba(255,255,255,0.04)", color: "#fff", fontFamily: SAIRA, fontSize: 20, fontWeight: 700, cursor: "pointer", lineHeight: 1 };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <button type="button" aria-label="menos" style={btn} onClick={() => onDelta(-1)}>−</button>
      <span style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: 46, width: 52, textAlign: "center", color, textShadow: `0 4px 24px ${color}66` }}>{value}</span>
      <button type="button" aria-label="mais" style={btn} onClick={() => onDelta(1)}>+</button>
    </div>
  );
}

export function PalpiteDeck({ scenario, narrow }: { scenario: Scenario; narrow: boolean }) {
  const { theme, home, away } = scenario;
  const [h, setH] = useState(1);
  const [a, setA] = useState(1);
  const [sent, setSent] = useState(false);
  const clamp = (n: number) => Math.max(0, Math.min(9, n));
  // Static mock crowd split for the consensus bar.
  const split = { home: 44, draw: 29, away: 27 };

  return (
    <div style={{ display: "flex", flexDirection: narrow ? "column" : "row", gap: 16, alignItems: "stretch" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14, padding: 18, borderRadius: 16, background: "rgba(255,255,255,0.03)", border: `1px solid ${theme.metal}44`, boxShadow: `inset 0 0 40px ${theme.metalSoft}` }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
          <span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: 17, color: theme.metal }}>CRAVE O PLACAR</span>
          <span style={mono(9, "rgba(255,255,255,0.5)")}>vale ponto no ranking</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <span style={mono(10, home.primary)}>{home.code}</span>
            <Stepper value={h} color={home.primary} onDelta={(d) => { setH((v) => clamp(v + d)); setSent(false); }} />
          </div>
          <span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: 26, color: "rgba(255,255,255,0.3)" }}>×</span>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <span style={mono(10, away.primary)}>{away.code}</span>
            <Stepper value={a} color={away.primary} onDelta={(d) => { setA((v) => clamp(v + d)); setSent(false); }} />
          </div>
        </div>
        <button
          type="button"
          onClick={() => setSent(true)}
          style={{ padding: "13px 18px", borderRadius: 12, border: "none", cursor: "pointer", fontFamily: BRIC, fontWeight: 800, fontSize: 15, letterSpacing: "0.06em", color: theme.key === "final" ? "#2a1c00" : "#241206", background: sent ? "rgba(255,255,255,0.12)" : `linear-gradient(100deg, ${theme.metal}, ${theme.metalDeep})`, boxShadow: sent ? "none" : `0 12px 30px -10px ${theme.glow}`, transition: "all .2s" }}
        >
          {sent ? `✓ PALPITE CRAVADO — ${home.code} ${h}×${a} ${away.code}` : `CRAVAR ${home.code} ${h} × ${a} ${away.code}`}
        </button>
        <span style={{ ...mono(9, "rgba(255,255,255,0.45)"), textAlign: "center" }}>fecha no apito inicial · nome do sub definido no login</span>
      </div>

      {/* Consensus */}
      <div style={{ flex: narrow ? "none" : "0 0 240px", display: "flex", flexDirection: "column", gap: 12, padding: 18, borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: 15, color: "#fff" }}>A COMUNIDADE ACHA</span>
        <div style={{ display: "flex", height: 15, borderRadius: 8, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ width: `${split.home}%`, background: home.primary }} />
          <div style={{ width: `${split.draw}%`, background: "rgba(255,255,255,0.22)" }} />
          <div style={{ width: `${split.away}%`, background: away.primary }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", ...mono(10, "rgba(255,255,255,0.7)") }}>
          <span style={{ color: home.primary }}>{home.code} {split.home}%</span>
          <span>EMP {split.draw}%</span>
          <span style={{ color: away.primary }}>{away.code} {split.away}%</span>
        </div>
        <div style={{ marginTop: "auto", padding: "10px 12px", borderRadius: 10, background: theme.metalSoft, border: `1px solid ${theme.metal}33` }}>
          <span style={mono(9, theme.metal)}>{theme.trophy} placar mais cravado</span>
          <div style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: 22, color: "#fff", marginTop: 3 }}>{home.code} 2 × 1 {away.code}</div>
        </div>
      </div>
    </div>
  );
}

/** A head-to-head match stat. The ESPN scoreboard doesn't carry these, so the
 *  real view omits the panel rather than inventing numbers; the mock sandbox
 *  passes its own. */
export interface LiveStat {
  label: string;
  h: number;
  a: number;
  unit: string;
}

export function LiveDeck({ scenario, narrow, stats }: { scenario: Scenario; narrow: boolean; stats?: LiveStat[] }) {
  const { match, theme, home, away } = scenario;
  const color = (side: "home" | "away") => (side === "home" ? home.primary : away.primary);
  const pct = (clock: string) => `${Math.min(98, (parseInt(clock, 10) / 90) * 100)}%`;
  return (
    <div style={{ display: "flex", flexDirection: narrow ? "column" : "row", gap: 16, alignItems: "stretch" }}>
      {/* Goal timeline */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14, padding: 18, borderRadius: 16, background: "rgba(255,255,255,0.03)", border: `1px solid ${theme.metal}44` }}>
        <span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: 15, color: theme.metal }}>⚽ GOLS DA PARTIDA</span>
        <div style={{ position: "relative", height: 46, borderRadius: 10, background: "linear-gradient(90deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))", border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
          <div aria-hidden style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.12)" }} />
          {match.goals.map((g, i) => (
            <div key={i} style={{ position: "absolute", left: pct(g.clock), top: g.side === "home" ? 4 : "auto", bottom: g.side === "away" ? 4 : "auto", transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
              <span style={{ width: 12, height: 12, borderRadius: "50%", background: color(g.side), boxShadow: `0 0 8px ${color(g.side)}`, border: "2px solid rgba(0,0,0,0.4)" }} />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {match.goals.map((g, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: g.side === "away" ? "flex-end" : "flex-start" }}>
              {g.side === "home" && <span style={{ ...mono(11, color("home")), width: 34 }}>{g.clock}</span>}
              <span style={{ fontFamily: BRIC, fontWeight: 700, fontSize: 14, color: "#fff" }}>{g.side === "away" ? "" : "⚽ "}{g.scorer}{g.penalty ? " (P)" : ""}{g.side === "away" ? " ⚽" : ""}</span>
              {g.side === "away" && <span style={{ ...mono(11, color("away")), width: 34, textAlign: "right" }}>{g.clock}</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Stat bars — only when the caller has real numbers to show. */}
      {stats && stats.length > 0 && (
      <div style={{ flex: narrow ? "none" : "0 0 280px", display: "flex", flexDirection: "column", gap: 13, padding: 18, borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: 15, color: "#fff" }}>NÚMEROS AO VIVO</span>
        {stats.map((s) => {
          const total = s.h + s.a || 1;
          return (
            <div key={s.label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", ...mono(9.5, "rgba(255,255,255,0.7)") }}>
                <span style={{ color: home.primary }}>{s.h}{s.unit}</span>
                <span>{s.label}</span>
                <span style={{ color: away.primary }}>{s.a}{s.unit}</span>
              </div>
              <div style={{ display: "flex", height: 7, borderRadius: 4, overflow: "hidden", background: "rgba(255,255,255,0.06)" }}>
                <div style={{ width: `${(s.h / total) * 100}%`, background: home.primary }} />
                <div style={{ width: `${(s.a / total) * 100}%`, background: away.primary }} />
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}

function PathColumn({ d, align }: { d: Dossier; align: "flex-start" | "flex-end" }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7, alignItems: align }}>
      <span style={mono(9, d.primary, "0.14em")}>CAMINHO · {d.code}</span>
      {d.path.map((leg) => (
        <div key={leg.round} style={{ display: "flex", alignItems: "center", gap: 9, flexDirection: align === "flex-end" ? "row-reverse" : "row" }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: leg.won ? "#5ce08a" : "#ff6b6b", flex: "none" }} />
          <span style={mono(9, "rgba(255,255,255,0.45)", "0.08em")}>{leg.round}</span>
          <span style={{ fontFamily: SAIRA, fontWeight: 700, fontSize: 13, color: leg.won ? "#fff" : "rgba(255,255,255,0.55)" }}>{leg.score}</span>
          <span style={mono(9.5, "rgba(255,255,255,0.6)")}>{leg.opp}</span>
        </div>
      ))}
    </div>
  );
}

export function PathDeck({ scenario, narrow, compact = false }: { scenario: Scenario; narrow: boolean; compact?: boolean }) {
  const { home, away, theme } = scenario;
  return (
    <div style={{ flex: "none", display: "flex", flexDirection: narrow ? "column" : "row", gap: narrow ? 12 : 30, padding: compact ? "10px 18px" : "16px 20px", borderRadius: 16, background: "rgba(0,0,0,0.22)", border: `1px solid ${theme.metal}22` }}>
      <PathColumn d={home} align="flex-start" />
      {!narrow && <div aria-hidden style={{ width: 1, background: `linear-gradient(${theme.metal}00,${theme.metal}44,${theme.metal}00)` }} />}
      <PathColumn d={away} align={narrow ? "flex-start" : "flex-end"} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function AmbientParticles({ theme }: { theme: ShowpieceTheme }) {
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {Array.from({ length: 9 }).map((_, i) => (
        <span key={i} style={{ position: "absolute", left: `${8 + i * 10}%`, bottom: `${(i % 3) * 12}%`, width: 3, height: 3, borderRadius: "50%", background: theme.metal, opacity: 0.4, animation: `spDrift ${6 + (i % 4)}s linear ${i * 0.7}s infinite` }} />
      ))}
    </div>
  );
}

export function ShowpieceBanner({ theme, narrow, compact = false }: { theme: ShowpieceTheme; narrow: boolean; compact?: boolean }) {
  return (
    <div style={{ position: "relative", flex: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: compact ? 1 : 4, marginBottom: narrow ? 12 : compact ? 8 : 18 }}>
      <span style={mono(compact ? 8.5 : 9.5, "rgba(255,255,255,0.5)", "0.2em")}>{theme.kicker}</span>
      <h1 style={{ margin: 0, fontFamily: BRIC, fontWeight: 800, fontSize: narrow ? 32 : compact ? 32 : 52, letterSpacing: "0.02em", lineHeight: 1, backgroundImage: `linear-gradient(100deg, ${theme.metalDeep} 20%, #fff8e6 42%, ${theme.metal} 55%, ${theme.metalDeep} 78%)`, backgroundSize: "220% 100%", WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent", animation: "spTitleSheen 6s linear infinite", textAlign: "center" }}>
        {theme.trophy} {theme.title}
      </h1>
      {!compact && <span style={{ fontFamily: BRIC, fontSize: 13, fontStyle: "italic", color: "rgba(255,255,255,0.6)" }}>{theme.subtitle}</span>}
    </div>
  );
}

export function ShowpieceArena({ scenario, narrow, compact = false }: { scenario: Scenario; narrow: boolean; compact?: boolean }) {
  return (
    <div style={{ position: "relative", flex: "none", display: "flex", flexDirection: narrow ? "column" : "row", alignItems: "stretch", gap: narrow ? 6 : 0, marginBottom: compact ? 12 : 18 }}>
      <TeamHalf d={scenario.home} side="home" theme={scenario.theme} narrow={narrow} compact={compact} />
      <CenterColumn scenario={scenario} narrow={narrow} compact={compact} />
      <TeamHalf d={scenario.away} side="away" theme={scenario.theme} narrow={narrow} compact={compact} />
    </div>
  );
}

/** The showpiece frame (bg + styles + particles), shared by v1 and v2.
 *  `fill` = embedded in the real live view: a non-scrolling flex column that FITS
 *  the available dashboard height (compact hero + a flex-1 engagement region whose
 *  lists scroll internally), transparent so the themed page background shows
 *  through. Otherwise (the sandbox) it's a rounded card that grows the page. */
export function ShowpieceFrame({ theme, narrow, fill = false, children }: { theme: ShowpieceTheme; narrow: boolean; fill?: boolean; children: ReactNode }) {
  const box: CSSProperties = fill
    ? { height: "100%", minHeight: 0, overflow: "hidden", borderRadius: 0, background: "transparent", display: "flex", flexDirection: "column", gap: 8 }
    : { minHeight: "100%", overflow: "hidden", borderRadius: 18, background: theme.pageBg };
  return (
    <div style={{ position: "relative", padding: narrow ? "10px 10px 18px" : fill ? "6px 26px 8px" : "24px 30px 30px", ...box }}>
      <ShowpieceStyles />
      <AmbientParticles theme={theme} />
      {children}
    </div>
  );
}

export function ShowpieceMatch({ scenario, narrow = false }: { scenario: Scenario; narrow?: boolean }) {
  const live = scenario.match.state === "in";
  return (
    <ShowpieceFrame theme={scenario.theme} narrow={narrow}>
      <ShowpieceBanner theme={scenario.theme} narrow={narrow} />
      <ShowpieceArena scenario={scenario} narrow={narrow} />
      <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 16 }}>
        {live ? <LiveDeck scenario={scenario} narrow={narrow} stats={MOCK_STATS} /> : <PalpiteDeck scenario={scenario} narrow={narrow} />}
        <PathDeck scenario={scenario} narrow={narrow} />
      </div>
    </ShowpieceFrame>
  );
}
