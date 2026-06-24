import type { MatchLineups, MatchSub, TeamLineup } from "@/lib/espn";
import { JB } from "@/components/live/bf-ui";

/** Escalações (XI + substitutions). Carried over from the original live view so the
 *  "Escalação" toggle keeps working; restyled to the v3 dark palette. */
function LineupBlock({ team, followCode }: { team: TeamLineup; followCode: string | null }) {
  const followed = team.code === followCode;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
        <span style={{ fontFamily: JB, fontWeight: 600, fontSize: 14, letterSpacing: "0.04em", color: followed ? "#c8ff2d" : "#f1f7f0" }}>{team.code}</span>
        <span style={{ fontFamily: JB, fontSize: 11, letterSpacing: "0.08em", color: "#6f8a78", whiteSpace: "nowrap" }}>{team.formation}</span>
      </div>
      {team.players.map((p, i) => (
        <div key={`${p.number}-${i}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <span style={{ flex: "0 0 22px", fontFamily: JB, fontSize: 12, color: "#c8ff2d", textAlign: "right" }}>{p.number}</span>
          <span style={{ flex: "0 0 26px", fontFamily: JB, fontSize: 10, letterSpacing: "0.04em", color: "#6f8a78" }}>{p.pos}</span>
          <span style={{ flex: "1 1 auto", fontSize: 13, color: "#e9ece8" }}>{p.name}</span>
        </div>
      ))}
    </div>
  );
}

function SubsBlock({ subs, homeCode, awayCode }: { subs: MatchSub[]; homeCode: string; awayCode: string }) {
  if (subs.length === 0) return null;
  const codeFor = (s: MatchSub) => (s.side === "home" ? homeCode : awayCode);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontFamily: JB, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6f8a78", marginBottom: 2 }}>Substituições</div>
      {subs.map((s, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <span style={{ flex: "0 0 34px", fontFamily: JB, fontSize: 12, color: "#c8ff2d" }}>{s.clock}</span>
          <span style={{ flex: "0 0 30px", fontFamily: JB, fontSize: 10, letterSpacing: "0.04em", color: "#6f8a78" }}>{codeFor(s)}</span>
          <span style={{ flex: "1 1 auto", fontSize: 13, color: "#e9ece8" }}>
            <span style={{ color: "#c8ff2d" }}>▲</span> {s.playerIn}
            <span style={{ color: "#6f8a78" }}> ▼ {s.playerOut}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

export function LineupPanel({ lineups, followCode }: { lineups: MatchLineups | null; followCode: string | null }) {
  if (!lineups) {
    return <div style={{ padding: "20px 18px", fontSize: 13, color: "#6f8a78" }}>Escalações ainda não divulgadas.</div>;
  }
  return (
    <div style={{ flex: "1 1 auto", padding: "4px 2px", display: "flex", flexDirection: "column", gap: 20, overflowY: "auto", minHeight: 0 }}>
      <LineupBlock team={lineups.home} followCode={followCode} />
      <LineupBlock team={lineups.away} followCode={followCode} />
      <SubsBlock subs={lineups.subs} homeCode={lineups.home.code} awayCode={lineups.away.code} />
    </div>
  );
}
