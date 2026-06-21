import type { Match } from "@/lib/espn";
import type { VoteEntry } from "@/lib/votes";
import { rankSubs } from "@/lib/ranking";
import { MONO, cardStyle } from "@/components/primitives";

export interface RankingViewProps {
  entries: VoteEntry[];
  matches: Match[];
}

export function RankingView({ entries, matches }: RankingViewProps) {
  const byId: Record<string, Match> = {};
  for (const m of matches) byId[m.id] = m;
  const ranks = rankSubs(entries, byId);

  return (
    <section>
      <div style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
        <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--rank)" }}>
          Ranking dos Subs · vitórias &amp; derrotas
        </span>
        <span style={{ fontSize: 14, color: "var(--ink-3)" }}>
          Acertar o placar exato vale vitória; o resto, derrota. Soma todas as partidas encerradas.
        </span>
      </div>

      {ranks.length === 0 ? (
        <div style={{ ...cardStyle, padding: "40px 24px", textAlign: "center", color: "var(--ink-3)" }}>
          Ainda não há palpites avaliados. Volte após o fim das partidas.
        </div>
      ) : (
        <div style={{ ...cardStyle, maxWidth: 640 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: "1px solid var(--line)", fontFamily: MONO, fontSize: 10, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--ink-3)" }}>
            <span style={{ flex: "0 0 28px", textAlign: "right" }}>#</span>
            <span style={{ flex: "1 1 auto" }}>Sub</span>
            <span style={{ flex: "0 0 40px", textAlign: "center" }}>V</span>
            <span style={{ flex: "0 0 40px", textAlign: "center" }}>D</span>
            <span style={{ flex: "0 0 52px", textAlign: "right" }}>Aprov.</span>
          </div>
          {ranks.map((r, i) => {
            const total = r.wins + r.losses;
            const pct = total ? Math.round((r.wins / total) * 100) : 0;
            const top = i === 0;
            return (
              <div
                key={r.username}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 16px",
                  borderBottom: "1px solid var(--line)",
                  background: top ? "rgba(250, 204, 21, 0.08)" : "transparent",
                }}
              >
                <span style={{ flex: "0 0 28px", textAlign: "right", fontFamily: MONO, fontSize: 13, fontWeight: top ? 500 : 400, color: i < 3 ? "var(--rank)" : "var(--ink-3)" }}>{i + 1}</span>
                <span style={{ flex: "1 1 auto", fontSize: 14, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.username}</span>
                <span style={{ flex: "0 0 40px", textAlign: "center", fontFamily: MONO, fontWeight: 500, fontSize: 14, color: "var(--signal-strong)" }}>{r.wins}</span>
                <span style={{ flex: "0 0 40px", textAlign: "center", fontFamily: MONO, fontSize: 14, color: "var(--ink-3)" }}>{r.losses}</span>
                <span style={{ flex: "0 0 52px", textAlign: "right", fontFamily: MONO, fontSize: 13, color: "var(--ink-2)" }}>{pct}%</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
