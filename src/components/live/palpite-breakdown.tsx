import type { LivePalpite, LivePalpiteBreakdown } from "@/lib/live-palpites";
import { isReservedName } from "@shared/name-claim";
import { BRIC, JB, SectionLabel } from "@/components/live/bf-ui";

const SKIN = {
  win: { statusColor: "#0f1f02", tagBg: "#c8ff2d", cardBg: "linear-gradient(120deg, rgba(200,255,45,0.17), rgba(200,255,45,0.03))", cardBorder: "1px solid rgba(200,255,45,0.55)", nameColor: "#eaffc0", pickColor: "#c2e69e", opacity: 1 },
  open: { statusColor: "#f2c14e", tagBg: "rgba(242,193,78,0.14)", cardBg: "rgba(242,193,78,0.06)", cardBorder: "1px solid rgba(242,193,78,0.3)", nameColor: "#f3e2bf", pickColor: "#c7b482", opacity: 0.78 },
  lost: { statusColor: "#ff8f8f", tagBg: "rgba(255,90,106,0.12)", cardBg: "rgba(255,90,106,0.05)", cardBorder: "1px solid rgba(255,90,106,0.18)", nameColor: "#c7a6a6", pickColor: "#8a6f6f", opacity: 0.42 },
} as const;

function pickStr(p: LivePalpite, homeCode: string, awayCode: string): string {
  return `${homeCode} [${p.predHome}] × [${p.predAway}] ${awayCode}`;
}

function nameStyle(name: string, fallback: string) {
  // The house bot reads as "official" — give it a distinct color.
  return isReservedName(name) ? { color: "#a99bff" } : { color: fallback };
}

export function PalpiteBreakdown({
  breakdown,
  homeCode,
  awayCode,
  total,
  closed,
}: {
  breakdown: LivePalpiteBreakdown;
  homeCode: string;
  awayCode: string;
  total: number;
  closed: boolean;
}) {
  const { winners, open, lost } = breakdown;
  const empty = winners.length + open.length + lost.length === 0;

  return (
    <div style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", gap: 9 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flex: "none" }}>
        <SectionLabel>{`// PALPITES · ${homeCode} × ${awayCode}`}</SectionLabel>
        <span style={{ fontFamily: JB, fontSize: 9.5, color: "#4d6353" }}>
          {total} {total === 1 ? "palpite" : "palpites"} · {closed ? "encerrados" : "ao vivo"}
        </span>
      </div>

      <div className="bf-scroll" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 9, paddingRight: 4, overflowY: "auto", overflowX: "hidden" }}>
      {empty ? (
        <div style={{ fontFamily: BRIC, fontSize: 12.5, color: "#7d9a86", padding: "6px 2px" }}>
          Nenhum palpite nesta partida ainda.
        </div>
      ) : null}

      {winners.length > 0 ? (
        <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
          {winners.map((p, i) => {
            const s = SKIN.win;
            return (
              <div key={`w${i}`} style={{ flex: "1 1 220px", minWidth: 0, borderRadius: 9, padding: "6px 9px", background: s.cardBg, border: s.cardBorder, boxShadow: "0 0 20px -10px rgba(200,255,45,0.5)", display: "flex", alignItems: "center", gap: 9 }}>
                <span style={{ flex: "none", width: 22, height: 22, borderRadius: "50%", background: "#c8ff2d", color: "#0f1f02", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>✓</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: BRIC, fontWeight: 800, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", ...nameStyle(p.username, s.nameColor) }}>{p.username}</div>
                  <div style={{ fontFamily: JB, fontSize: 9.5, color: s.pickColor }}>{pickStr(p, homeCode, awayCode)}</div>
                </div>
                <span style={{ flex: "none", fontFamily: JB, fontSize: 8.5, letterSpacing: "0.05em", fontWeight: 700, padding: "5px 8px", borderRadius: 7, background: s.tagBg, color: s.statusColor }}>{p.status}</span>
              </div>
            );
          })}
        </div>
      ) : null}

      {open.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {open.map((p, i) => {
            const s = SKIN.open;
            return (
              <div key={`o${i}`} style={{ borderRadius: 8, padding: "6px 9px", background: s.cardBg, border: s.cardBorder, opacity: s.opacity, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: BRIC, fontWeight: 700, fontSize: 11.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", ...nameStyle(p.username, s.nameColor) }}>{p.username}</div>
                  <div style={{ fontFamily: JB, fontSize: 9, color: s.pickColor }}>{pickStr(p, homeCode, awayCode)}</div>
                </div>
                <span style={{ flex: "none", fontFamily: JB, fontSize: 8.5, color: s.statusColor }}>{p.status}</span>
              </div>
            );
          })}
        </div>
      ) : null}

      {lost.length > 0 ? (
        <div style={{ marginTop: 1 }}>
          <div style={{ marginBottom: 6 }}><SectionLabel color="#6f8a78" style={{ fontSize: 9, letterSpacing: "0.14em" }}>{"// JÁ ELIMINADOS"}</SectionLabel></div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {lost.map((p, i) => {
              const s = SKIN.lost;
              return (
                <div key={`l${i}`} style={{ flex: "1 1 170px", minWidth: 0, opacity: s.opacity, borderRadius: 8, padding: "5px 8px", background: s.cardBg, border: s.cardBorder, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: BRIC, fontWeight: 600, fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", ...nameStyle(p.username, s.nameColor) }}>{p.username}</div>
                    <div style={{ fontFamily: JB, fontSize: 8.5, color: s.pickColor, textDecoration: "line-through" }}>{pickStr(p, homeCode, awayCode)}</div>
                  </div>
                  <span style={{ flex: "none", fontFamily: JB, fontSize: 8.5, color: s.statusColor }}>{p.status}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
      </div>
    </div>
  );
}
