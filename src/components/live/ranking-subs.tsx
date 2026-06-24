import type { CSSProperties } from "react";
import type { Match } from "@/lib/espn";
import type { VoteEntry } from "@/lib/votes";
import { rankSubs, worstPalpiteiro, type SubRank } from "@/lib/ranking";
import { isReservedName } from "@shared/name-claim";
import { BRIC, JB, SAIRA, LIME_DEEP, GOLD, GOLD_DEEP } from "@/components/live/bf-ui";

const WL = ({ w, l, big = false }: { w: number; l: number; big?: boolean }) => (
  <span style={{ fontFamily: SAIRA, fontWeight: 700, fontSize: big ? 14 : 13 }}>
    <span style={{ color: LIME_DEEP }}>{w}</span>
    <span style={{ color: "#5c7560" }}>–{l}</span>
  </span>
);

function nameColor(name: string, fallback: string): string {
  return isReservedName(name) ? "#a99bff" : fallback;
}

function Row({ r, rank, dense }: { r: SubRank; rank: number; dense?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: dense ? "5px 7px" : "6px 8px", borderRadius: 8, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: dense ? 8 : 11, minWidth: 0 }}>
        <span style={{ width: dense ? 13 : 16, textAlign: "right", flex: "none", fontFamily: JB, fontSize: dense ? 10 : 10.5, color: rank <= 3 ? GOLD_DEEP : "#6a716b" }}>{rank}</span>
        <span style={{ fontFamily: BRIC, fontSize: dense ? 11 : 12.5, fontWeight: 600, color: nameColor(r.username, "#e9ece8"), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.username}</span>
      </div>
      <WL w={r.wins} l={r.losses} />
    </div>
  );
}

export interface RankingSubsProps {
  entries: VoteEntry[];
  matches: Match[];
  /** "grid" = the wide PLACAR 2-col list; "column" = a single fading column. */
  variant?: "grid" | "column";
  style?: CSSProperties;
}

export function RankingSubs({ entries, matches, variant = "column", style }: RankingSubsProps) {
  const byId: Record<string, Match> = {};
  for (const m of matches) byId[m.id] = m;
  const ranks = rankSubs(entries, byId);
  const leader = ranks[0] ?? null;
  const rest = ranks.slice(1);
  const worst = worstPalpiteiro(ranks);

  return (
    <div style={{ borderRadius: 12, border: "1px solid rgba(255,179,71,0.2)", background: "rgba(255,255,255,0.02)", padding: 13, display: "flex", flexDirection: "column", minHeight: 0, ...style }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: 14, color: GOLD }}>Ranking dos Subs</span>
        <span style={{ fontFamily: JB, fontSize: 9, color: "#6f8a78" }}>V &amp; D</span>
      </div>

      {leader ? (
        <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 9px", borderRadius: 9, background: "linear-gradient(120deg, rgba(232,181,58,0.2), rgba(232,181,58,0.02))", border: "1px solid rgba(232,181,58,0.45)", marginBottom: 7 }}>
        <span style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: 18, color: GOLD_DEEP, lineHeight: 1, width: 16, textAlign: "center", flex: "none" }}>1</span>
          <span style={{ flex: 1, minWidth: 0, fontFamily: BRIC, fontWeight: 800, fontSize: 13, color: isReservedName(leader.username) ? "#a99bff" : "#f3d27a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{leader.username}</span>
          <span style={{ flex: "none", fontFamily: JB, fontSize: 7, letterSpacing: "0.08em", color: "#caa94a" }}>LÍDER</span>
          <WL w={leader.wins} l={leader.losses} big />
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", fontFamily: BRIC, fontSize: 12, color: "#6f8a78", padding: "18px 8px" }}>
          Sem palpites avaliados ainda. Volte após o fim das partidas.
        </div>
      )}

      {rest.length > 0 ? (
        variant === "grid" ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px", alignContent: "start", overflow: "hidden", flex: 1, minHeight: 0 }}>
            {rest.map((r, i) => <Row key={r.username} r={r} rank={i + 2} />)}
          </div>
        ) : (
          <div className="bf-fade-y" style={{ display: "flex", flexDirection: "column", overflow: "hidden", flex: 1, minHeight: 0 }}>
            {rest.map((r, i) => <Row key={r.username} r={r} rank={i + 2} dense />)}
          </div>
        )
      ) : null}

      {worst ? (
        <div style={{ flex: "none", marginTop: 7, display: "flex", alignItems: "center", gap: 9, padding: "7px 10px", borderRadius: 9, background: "rgba(255,77,77,0.12)", border: "1px solid rgba(255,77,77,0.45)", boxShadow: "0 6px 18px -6px rgba(255,77,77,0.5)" }}>
          <span style={{ flex: "none", fontFamily: JB, fontSize: 7, lineHeight: 1.25, letterSpacing: "0.06em", color: "#ff9a9a" }}>PIOR<br />PALPITEIRO</span>
          <span style={{ flex: 1, minWidth: 0, fontFamily: BRIC, fontWeight: 800, fontSize: 12, color: "#ffb3b3", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{worst.username}</span>
          <span style={{ flex: "none", fontFamily: SAIRA, fontWeight: 800, fontSize: 17, color: "#ff6b6b" }}>{Math.round(worst.pct * 100)}%</span>
        </div>
      ) : null}
    </div>
  );
}
