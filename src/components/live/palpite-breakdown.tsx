import type { CSSProperties } from "react";
import type { LivePalpite, LivePalpiteBreakdown } from "@/lib/live-palpites";
import { useMyName } from "@/lib/use-my-name";
import { BRIC, JB, SAIRA, FlagIcon, SectionLabel, VoceTag, isMe, nameStyle, teamAccent } from "@/components/live/bf-ui";

const SKIN = {
  win: { statusColor: "#0f1f02", tagBg: "#c8ff2d", cardBg: "linear-gradient(120deg, rgba(200,255,45,0.17), rgba(200,255,45,0.03))", cardBorder: "1px solid rgba(200,255,45,0.55)", nameColor: "#eaffc0", pickColor: "#c2e69e", opacity: 1 },
  open: { statusColor: "#f2c14e", tagBg: "rgba(242,193,78,0.14)", cardBg: "rgba(242,193,78,0.06)", cardBorder: "1px solid rgba(242,193,78,0.3)", nameColor: "#f3e2bf", pickColor: "#c7b482", opacity: 0.78 },
  lost: { statusColor: "#ff8f8f", tagBg: "rgba(255,90,106,0.12)", cardBg: "rgba(255,90,106,0.05)", cardBorder: "1px solid rgba(255,90,106,0.18)", nameColor: "#c7a6a6", pickColor: "#8a6f6f", opacity: 0.42 },
} as const;

function pickStr(p: LivePalpite, homeCode: string, awayCode: string): string {
  return `${homeCode} [${p.predHome}] × [${p.predAway}] ${awayCode}`;
}

/** Username line: the name (rainbow for the house bot) + a "VOCÊ" tag if it's you. */
function NameRow({ name, myName, color, font }: { name: string; myName: string | null; color: string; font: CSSProperties }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
      <span style={{ ...font, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0, ...nameStyle(name, color) }}>{name}</span>
      {isMe(name, myName) ? <VoceTag /> : null}
    </div>
  );
}

export function PalpiteBreakdown({
  breakdown,
  homeCode,
  awayCode,
  total,
  closed,
  penResult,
}: {
  breakdown: LivePalpiteBreakdown;
  homeCode: string;
  awayCode: string;
  total: number;
  closed: boolean;
  /** Final shootout result (after the match ends on pens): tally + winning side. */
  penResult?: { winner: "home" | "away"; home: number; away: number } | null;
}) {
  const { winners, open, lost } = breakdown;
  const myName = useMyName();
  const empty = winners.length + open.length + lost.length === 0;

  // Flatten with the live-status bucket so the pen split below can still show each
  // palpiteiro's standing (cravou / pode / fora).
  type Tagged = LivePalpite & { bucket: "win" | "open" | "lost" };
  const all: Tagged[] = [
    ...winners.map((p) => ({ ...p, bucket: "win" as const })),
    ...open.map((p) => ({ ...p, bucket: "open" as const })),
    ...lost.map((p) => ({ ...p, bucket: "lost" as const })),
  ];
  const hasPen = all.some((p) => p.penWinner);
  const homeVoters = all.filter((p) => p.penWinner === "home");
  const awayVoters = all.filter((p) => p.penWinner === "away");
  const noPen = all.filter((p) => !p.penWinner);
  const homeAccent = teamAccent(homeCode);
  const awayAccent = teamAccent(awayCode);

  const STATUS = { win: { c: "#c8ff2d", t: "cravou ✓" }, open: { c: "#f2c14e", t: "pode" }, lost: { c: "#9a7a7a", t: "fora" } } as const;
  const LIME = "#c8ff2d";
  // After a shootout: `won` = this voter called it right (+0,5), false = wrong.
  const penCard = (p: Tagged, accent: string, won: boolean | null) => {
    const st = STATUS[p.bucket];
    const dim = won === false || p.bucket === "lost";
    const bg = won === true ? "linear-gradient(120deg, rgba(200,255,45,0.16), rgba(200,255,45,0.03))" : accent + "12";
    const border = won === true ? `1px solid ${LIME}88` : `1px solid ${accent}44`;
    return (
      <div key={`${p.username}-${p.bucket}`} style={{ borderRadius: 8, padding: "6px 9px", background: bg, border, opacity: won === false ? 0.5 : dim ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <NameRow name={p.username} myName={myName} color={won === true ? "#eaffc0" : "#eef3ee"} font={{ fontFamily: BRIC, fontWeight: 700, fontSize: 12 }} />
          <div style={{ fontFamily: JB, fontSize: 9, color: "#9bb6a6", textDecoration: p.bucket === "lost" ? "line-through" : "none" }}>{pickStr(p, homeCode, awayCode)}</div>
        </div>
        {won === true ? (
          <span style={{ flex: "none", fontFamily: JB, fontSize: 8.5, fontWeight: 800, color: "#0f1f02", background: LIME, padding: "3px 7px", borderRadius: 6 }}>+0,5 ✓</span>
        ) : won === false ? (
          <span style={{ flex: "none", fontFamily: JB, fontSize: 8.5, color: "#9a7a7a" }}>errou</span>
        ) : (
          <span style={{ flex: "none", fontFamily: JB, fontSize: 8.5, fontWeight: 700, color: st.c }}>{st.t}</span>
        )}
      </div>
    );
  };
  const penColumn = (code: string, accent: string, voters: Tagged[], side: "home" | "away") => {
    const won = penResult ? penResult.winner === side : null;
    const tally = penResult ? penResult[side] : null;
    return (
      <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", gap: 7 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 10px", borderRadius: 8, background: won ? "rgba(200,255,45,0.16)" : accent + "22", border: `1px solid ${won ? LIME + "aa" : accent + "66"}`, flex: "none", opacity: won === false ? 0.6 : 1 }}>
          <FlagIcon code={code} size={14} />
          <span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: 13.5, color: won ? LIME : accent }}>{code}</span>
          {penResult ? (
            <>
              <span style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: 16, color: won ? LIME : "#cfd9d1" }}>{tally}</span>
              <span style={{ marginLeft: "auto", fontFamily: JB, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.06em", color: won ? LIME : "#8a6f6f" }}>{won ? "✓ VENCEU" : "perdeu"}</span>
            </>
          ) : (
            <span style={{ marginLeft: "auto", fontFamily: JB, fontSize: 9, color: "#9bb6a6" }}>{voters.length} {voters.length === 1 ? "voto" : "votos"}</span>
          )}
        </div>
        <div className="bf-scroll" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 6, overflowY: "auto", overflowX: "hidden", paddingRight: 2 }}>
          {voters.length === 0 ? <span style={{ fontFamily: BRIC, fontSize: 11, color: "#6f8a78", padding: "4px 2px" }}>ninguém ainda</span> : voters.map((p) => penCard(p, accent, won))}
        </div>
      </div>
    );
  };

  return (
    <div style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", gap: 9 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flex: "none" }}>
        <SectionLabel>{`// PALPITES · ${homeCode} × ${awayCode}`}</SectionLabel>
        <span style={{ fontFamily: JB, fontSize: 9.5, color: "#4d6353" }}>
          {total} {total === 1 ? "palpite" : "palpites"} · {closed ? "encerrados" : "ao vivo"}
        </span>
      </div>

      {empty ? (
        <div style={{ fontFamily: BRIC, fontSize: 12.5, color: "#7d9a86", padding: "6px 2px" }}>
          Nenhum palpite nesta partida ainda.
        </div>
      ) : hasPen ? (
        // Knockout pen context: split everyone by who they called for the shootout,
        // each column in that team's colour.
        <>
          <div style={{ flex: "none", fontFamily: JB, fontSize: 9, letterSpacing: "0.08em", color: "#caa94a" }}>
            {penResult ? `RESULTADO DOS PÊNALTIS · ${penResult.home}–${penResult.away} · quem cravou ganha +0,5` : "QUEM VENCE NOS PÊNALTIS — POR TIME"}
          </div>
          <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 10 }}>
            {penColumn(homeCode, homeAccent, homeVoters, "home")}
            {penColumn(awayCode, awayAccent, awayVoters, "away")}
          </div>
          {noPen.length > 0 ? (
            <div style={{ flex: "none", fontFamily: JB, fontSize: 8.5, color: "#6f8a78" }}>{noPen.length} {penResult ? "não palpitaram o pênalti" : "ainda sem palpite de pênalti"}</div>
          ) : null}
        </>
      ) : (
      <div className="bf-scroll" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 9, paddingRight: 4, overflowY: "auto", overflowX: "hidden" }}>
      {winners.length > 0 ? (
        <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
          {winners.map((p, i) => {
            const s = SKIN.win;
            return (
              <div key={`w${i}`} style={{ flex: "1 1 220px", minWidth: 0, borderRadius: 9, padding: "6px 9px", background: s.cardBg, border: s.cardBorder, boxShadow: "0 0 20px -10px rgba(200,255,45,0.5)", display: "flex", alignItems: "center", gap: 9 }}>
                <span style={{ flex: "none", width: 22, height: 22, borderRadius: "50%", background: "#c8ff2d", color: "#0f1f02", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>✓</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <NameRow name={p.username} myName={myName} color={s.nameColor} font={{ fontFamily: BRIC, fontWeight: 800, fontSize: 13 }} />
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
                  <NameRow name={p.username} myName={myName} color={s.nameColor} font={{ fontFamily: BRIC, fontWeight: 700, fontSize: 11.5 }} />
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
                    <NameRow name={p.username} myName={myName} color={s.nameColor} font={{ fontFamily: BRIC, fontWeight: 600, fontSize: 11 }} />
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
      )}
    </div>
  );
}
