import type { CSSProperties } from "react";
import type { Match, MatchSub, Side } from "@/lib/espn";
import { flagFileBase } from "@/lib/team-names";
import { isReservedName } from "@shared/name-claim";

/** BaltFut v3 (AO VIVO) shared design kit: fonts, colors, team accents, the
 *  waving-flag crest, live-dot and the goal/card timeline builder. Kept in one
 *  module so the hero, duo cards and pre-match view stay visually consistent. */

export const ASSET_BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

// Type roles (see layout.tsx). Display vs numerals vs labels vs code-badges.
export const BRIC = "var(--font-bric)";
export const SAIRA = "var(--font-saira)";
export const JB = "var(--font-jb)";
export const ARCHIVO = "var(--font-archivo)";

// Core accents (mirror the --bf-* CSS tokens; inlined where a JS value is needed).
export const LIME = "#c8ff2d";
export const LIME_DEEP = "#9ef01f";
export const GOLD = "#ffb347";
export const GOLD_DEEP = "#e8b53a";
export const TEXT = "#f1f7f0";
export const DIM = "#7d9a86";
export const DIM_2 = "#6f8a78";
export const DANGER = "#ff4d4d";
export const CARD_YELLOW = "#e9c64a";

// Recognizable per-team accent colors; everything else gets a stable hashed hue,
// so any World Cup side renders with a consistent, distinct color.
const TEAM_ACCENT: Record<string, string> = {
  BRA: "#f9d423", ARG: "#6cb2f0", ENG: "#ff5a6a", FRA: "#5b8def", GER: "#d8b24a",
  ESP: "#e5443b", POR: "#2fae6a", NED: "#ff8a3d", BEL: "#e5443b", ITA: "#4f8df0",
  CRO: "#5fa0e8", USA: "#5b8def", MEX: "#2fae6a", CAN: "#e5443b", URU: "#6cb2f0",
  COL: "#f9d423", ECU: "#f4c430", PAR: "#e5443b", PER: "#e5443b", CHI: "#e5443b",
  GHA: "#f2c14e", SEN: "#3fa45f", MAR: "#e5443b", EGY: "#d8b24a", CIV: "#ff7b29",
  NGA: "#2fae6a", ALG: "#2fae6a", TUN: "#e5443b", CMR: "#2fae6a", RSA: "#3fa45f",
  JPN: "#5b8def", KOR: "#5fa0e8", IRN: "#2fae6a", AUS: "#f4c430", KSA: "#2fae6a",
  QAT: "#d56a87", UZB: "#5fa0e8", JOR: "#e5443b", IRQ: "#e5443b", PAN: "#e5443b",
  CRC: "#e5443b", JAM: "#f4c430", HON: "#5fa0e8", NZL: "#cfd3ce", COD: "#2a8fd4",
  BIH: "#6cd592", SUI: "#e5443b", DEN: "#e5443b", NOR: "#e5443b", SWE: "#f4c430",
};

function hashHue(s: string): number {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 360;
}

export function teamAccent(code: string): string {
  return TEAM_ACCENT[code] ?? `hsl(${hashHue(code)} 68% 62%)`;
}

/** The house bot (e.g. "ChatGPT") renders with a rainbow-gradient name so it reads
 *  as "official", not a regular user. `background-clip: text` paints the gradient
 *  through the glyphs; `color` is the fallback where clip isn't supported. */
export const RAINBOW_NAME: CSSProperties = {
  background: "linear-gradient(90deg,#ff3b30,#ff9500,#ffcc00,#34c759,#00c7be,#0a84ff,#bf5af2)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  WebkitTextFillColor: "transparent",
  color: "#0a84ff",
};

/** Username text style: the rainbow gradient for the reserved house bot (wherever
 *  it appears — palpites and ranking), else a plain `color`. */
export function nameStyle(name: string, color: string): CSSProperties {
  return isReservedName(name) ? RAINBOW_NAME : { color };
}

/** True when `name` is the viewer's own nickname (case-insensitive). */
export function isMe(name: string, myName: string | null): boolean {
  return myName != null && name.trim().toLowerCase() === myName.trim().toLowerCase();
}

/** The small lime "VOCÊ" badge marking the viewer's own palpite / ranking row. */
export function VoceTag() {
  return (
    <span style={{ flex: "none", fontFamily: JB, fontSize: 7.5, letterSpacing: "0.06em", fontWeight: 700, color: "#0f1f02", background: LIME, padding: "2px 5px", borderRadius: 4 }}>
      VOCÊ
    </span>
  );
}

/** Leading minute of an event clock ("45'+2'" → 47) for timeline positioning. */
export function eventMinute(clock: string): number {
  const m = clock.match(/(\d+)(?:'?\s*\+\s*(\d+))?/);
  if (!m) return 0;
  return Number(m[1]) + (m[2] ? Number(m[2]) : 0);
}

export interface TimelineEvent {
  minute: number;
  leftPct: string;
  kind: "goal" | "yellow" | "red" | "sub";
  side: Side;
  /** Scorer / carded player / the player coming ON for a substitution. */
  player: string;
  /** The player going OFF (substitutions only). */
  playerOut?: string;
  minLabel: string;
  color: string;
}

/** Goals + cards (+ optional substitutions) merged into one chronological,
 *  percent-positioned event list. Subs come from the lineups (summary endpoint),
 *  so they're passed in separately from the scoreboard-derived goals/cards. */
export function buildTimeline(
  match: Match,
  homeAccent: string,
  awayAccent: string,
  subs: MatchSub[] = [],
): TimelineEvent[] {
  const pct = (clock: string) => `${Math.min(100, (eventMinute(clock) / 90) * 100).toFixed(1)}%`;
  const sideColor = (side: Side) => (side === "home" ? homeAccent : awayAccent);
  const goals: TimelineEvent[] = match.goals.map((g) => ({
    minute: eventMinute(g.clock),
    leftPct: pct(g.clock),
    kind: "goal",
    side: g.side,
    player: g.scorer,
    minLabel: g.clock,
    color: sideColor(g.side),
  }));
  const cards: TimelineEvent[] = match.cards.map((c) => ({
    minute: eventMinute(c.clock),
    leftPct: pct(c.clock),
    kind: c.kind,
    side: c.side,
    player: c.player,
    minLabel: c.clock,
    color: c.kind === "red" ? "#ff5a6a" : CARD_YELLOW,
  }));
  const subEvents: TimelineEvent[] = subs.map((s) => ({
    minute: eventMinute(s.clock),
    leftPct: pct(s.clock),
    kind: "sub",
    side: s.side,
    player: s.playerIn,
    playerOut: s.playerOut,
    minLabel: s.clock,
    color: sideColor(s.side),
  }));
  return [...goals, ...cards, ...subEvents].sort((a, b) => a.minute - b.minute);
}

/** The live match-clock label for the hero pill (e.g. "67'", "FIM"). */
export function matchClockLabel(match: Match): string {
  if (match.state === "post") return "FIM";
  return match.displayClock || match.statusDetail || "AO VIVO";
}

/** Pulsing live dot (the design's bfpulse cadence), glow optional. */
export function BfPulse({ size = 6, color = LIME, glow = true }: { size?: number; color?: string; glow?: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        display: "inline-block",
        flex: "0 0 auto",
        boxShadow: glow ? `0 0 7px ${color}` : "none",
        animation: "bfpulse 1.5s infinite",
      }}
    />
  );
}

/** `// SECTION` mono marker. */
export function SectionLabel({ children, color = LIME, style }: { children: React.ReactNode; color?: string; style?: CSSProperties }) {
  return (
    <span style={{ fontFamily: JB, fontSize: 10, letterSpacing: "0.16em", color, textTransform: "uppercase", ...style }}>
      {children}
    </span>
  );
}

/** Page section header: `// LABEL` marker + a dim mono subtitle. */
export function ViewHeader({ label, sub }: { label: string; sub: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
      <SectionLabel color={LIME}>{label}</SectionLabel>
      <span style={{ fontFamily: JB, fontSize: 10, letterSpacing: "0.06em", color: DIM_2 }}>{sub}</span>
    </div>
  );
}

/** Small flat country flag (rounded rect) for list rows. Renders nothing when the
 *  team has no vendored flag. */
export function FlagIcon({ code, size = 14 }: { code: string; size?: number }) {
  const base = flagFileBase(code);
  if (!base) return null;
  const w = Math.round(size * 1.36);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${ASSET_BASE}/flags/${base}.svg`}
      alt=""
      width={w}
      height={size}
      style={{ width: w, height: size, objectFit: "cover", borderRadius: 3, flex: "none", display: "inline-block", verticalAlign: "middle", boxShadow: "0 0 0 1px rgba(255,255,255,0.1)" }}
    />
  );
}

/**
 * The team crest: a circular waving national flag (bfwave) with a sweeping sheen
 * and a colored glow ring. Falls back to the team code (Archivo) when no flag
 * artwork exists. Player-cutout "craque" overlays are a planned follow-up (see the
 * FUTBIN image spike); for now every team shows its flag.
 */
export function FlagCrest({ code, accent, size = 92 }: { code: string; accent: string; size?: number }) {
  const base = flagFileBase(code);
  return (
    <div style={{ position: "relative", width: size, height: size, flex: "0 0 auto" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          overflow: "hidden",
          border: `2px solid ${accent}99`,
          boxShadow: `0 0 26px -8px ${accent}`,
          background: "rgba(255,255,255,0.05)",
        }}
      >
        {base ? (
          <div style={{ position: "absolute", inset: "-8%", animation: "bfwave 4.5s ease-in-out infinite" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${ASSET_BASE}/flags/${base}.svg`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <div
              aria-hidden
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                width: "46%",
                left: 0,
                background: "linear-gradient(100deg, transparent, rgba(255,255,255,0.4), transparent)",
                animation: "bfsheen 5s linear infinite",
              }}
            />
          </div>
        ) : (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: ARCHIVO, fontWeight: 800, fontSize: Math.round(size * 0.26), color: accent }}>
            {code}
          </div>
        )}
      </div>
    </div>
  );
}
