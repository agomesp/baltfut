import { useMemo, type CSSProperties } from "react";
import type { Match } from "@/lib/espn";
import type { VoteEntry } from "@/lib/votes";
import { rankSubs, worstPalpiteiro, type SubRank } from "@/lib/ranking";
import { useMyName } from "@/lib/use-my-name";
import { BRIC, JB, SAIRA, LIME_DEEP, GOLD, GOLD_DEEP, VoceTag, isMe, nameStyle } from "@/components/live/bf-ui";

/** pt-BR-format the (possibly fractional) win count: 1 → "1", 1.5 → "1,5". */
const fmtWins = (w: number) => (Number.isInteger(w) ? `${w}` : w.toFixed(1).replace(".", ","));

const WL = ({ w, l, pw, pl, big = false }: { w: number; l: number; pw: number; pl: number; big?: boolean }) => (
  <span style={{ display: "inline-flex", alignItems: "baseline", gap: 5, flex: "none" }}>
    <span style={{ fontFamily: SAIRA, fontWeight: 700, fontSize: big ? 14 : 13 }}>
      <span style={{ color: LIME_DEEP }}>{fmtWins(w)}</span>
      <span style={{ color: "#5c7560" }}>–{l}</span>
    </span>
    {pw + pl > 0 ? (
      <span title="pênaltis · acertos–erros (cada acerto vale 0,5)" style={{ fontFamily: JB, fontSize: big ? 9 : 8, letterSpacing: "0.03em", color: GOLD_DEEP, whiteSpace: "nowrap" }}>
        p {pw}–{pl}
      </span>
    ) : null}
  </span>
);

function Row({ r, rank, dense, myName }: { r: SubRank; rank: number; dense?: boolean; myName: string | null }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: dense ? "5px 7px" : "6px 8px", borderRadius: 8, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: dense ? 8 : 11, minWidth: 0 }}>
        <span style={{ width: dense ? 13 : 16, textAlign: "right", flex: "none", fontFamily: JB, fontSize: dense ? 10 : 10.5, color: rank <= 3 ? GOLD_DEEP : "#6a716b" }}>{rank}</span>
        <span style={{ fontFamily: BRIC, fontSize: dense ? 11 : 12.5, fontWeight: 600, minWidth: 0, ...nameStyle(r.username, "#e9ece8"), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.username}</span>
        {isMe(r.username, myName) ? <VoceTag /> : null}
      </div>
      <WL w={r.wins} l={r.losses} pw={r.penWins} pl={r.penLosses} />
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
  const myName = useMyName();
  // Memoized so a bare parent re-render (the live stages tick every second) does
  // NOT rebuild the map / re-rank / re-scan. Recomputes the moment its real inputs
  // change: `matches` is replaced on every scoreboard update (a finished match or
  // a score change → new array), and `entries` on every palpite poll/realtime
  // nudge — so the ranking still updates live, just not on idle clock ticks.
  const byId = useMemo(() => {
    const m: Record<string, Match> = {};
    for (const x of matches) m[x.id] = x;
    return m;
  }, [matches]);
  const ranks = useMemo(() => rankSubs(entries, byId), [entries, byId]);
  const worst = useMemo(() => worstPalpiteiro(ranks), [ranks]);
  const leader = ranks[0] ?? null;
  const rest = ranks.slice(1);

  return (
    <div style={{ borderRadius: 12, border: "1px solid rgba(255,179,71,0.2)", background: "rgba(255,255,255,0.02)", padding: 13, display: "flex", flexDirection: "column", minHeight: 0, ...style }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10, gap: 8 }}>
        <span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: 14, color: GOLD }}>Ranking dos Subs</span>
        <span style={{ display: "inline-flex", alignItems: "baseline", gap: 7, fontFamily: JB, fontSize: 9, flex: "none" }}>
          <span style={{ color: "#6f8a78" }}>V–D</span>
          <span title="pênaltis · acertos–erros (cada acerto vale 0,5)" style={{ color: GOLD_DEEP }}>p&nbsp;pên</span>
        </span>
      </div>

      {leader ? (
        <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 9px", borderRadius: 9, background: "linear-gradient(120deg, rgba(232,181,58,0.2), rgba(232,181,58,0.02))", border: "1px solid rgba(232,181,58,0.45)", marginBottom: 7 }}>
        <span style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: 18, color: GOLD_DEEP, lineHeight: 1, width: 16, textAlign: "center", flex: "none" }}>1</span>
          <span style={{ flex: 1, minWidth: 0, fontFamily: BRIC, fontWeight: 800, fontSize: 13, ...nameStyle(leader.username, "#f3d27a"), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{leader.username}</span>
          {isMe(leader.username, myName) ? <VoceTag /> : null}
          <span style={{ flex: "none", fontFamily: JB, fontSize: 7, letterSpacing: "0.08em", color: "#caa94a" }}>LÍDER</span>
          <WL w={leader.wins} l={leader.losses} pw={leader.penWins} pl={leader.penLosses} big />
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", fontFamily: BRIC, fontSize: 12, color: "#6f8a78", padding: "18px 8px" }}>
          Sem palpites avaliados ainda. Volte após o fim das partidas.
        </div>
      )}

      {rest.length > 0 ? (
        variant === "grid" ? (
          <div className="bf-scroll" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px", alignContent: "start", flex: 1, minHeight: 0, paddingRight: 4, overflowY: "auto", overflowX: "hidden" }}>
            {rest.map((r, i) => <Row key={r.username} r={r} rank={i + 2} myName={myName} />)}
          </div>
        ) : (
          <div className="bf-scroll" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, paddingRight: 4, overflowY: "auto", overflowX: "hidden" }}>
            {rest.map((r, i) => <Row key={r.username} r={r} rank={i + 2} dense myName={myName} />)}
          </div>
        )
      ) : null}

      {worst ? (
        <div style={{ flex: "none", marginTop: 7, display: "flex", alignItems: "center", gap: 9, padding: "7px 10px", borderRadius: 9, background: "rgba(255,77,77,0.12)", border: "1px solid rgba(255,77,77,0.45)", boxShadow: "0 6px 18px -6px rgba(255,77,77,0.5)" }}>
          <span style={{ flex: "none", fontFamily: JB, fontSize: 7, lineHeight: 1.25, letterSpacing: "0.06em", color: "#ff9a9a" }}>PIOR<br />PALPITEIRO</span>
          <span style={{ flex: 1, minWidth: 0, fontFamily: BRIC, fontWeight: 800, fontSize: 12, ...nameStyle(worst.username, "#ffb3b3"), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{worst.username}</span>
          {isMe(worst.username, myName) ? <VoceTag /> : null}
          <span style={{ flex: "none", fontFamily: SAIRA, fontWeight: 800, fontSize: 17, color: "#ff6b6b" }}>{Math.round(worst.pct * 100)}%</span>
        </div>
      ) : null}
    </div>
  );
}
