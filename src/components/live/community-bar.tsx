import type { Consensus } from "@/lib/consensus";
import { JB, SAIRA, SectionLabel } from "@/components/live/bf-ui";

/** "A Comunidade Palpita" — home/draw/away split + segmented bar. */
export function CommunityBar({
  consensus,
  homeCode,
  awayCode,
  homeAccent,
  awayAccent,
  withMarker = true,
}: {
  consensus: Consensus;
  homeCode: string;
  awayCode: string;
  homeAccent: string;
  awayAccent: string;
  withMarker?: boolean;
}) {
  const { homePct, drawPct, awayPct, total } = consensus;
  const cell = (pct: number, label: string, color: string) => (
    <span style={{ color }}>
      <b style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: 24 }}>{pct}%</b>{" "}
      <span style={{ fontFamily: JB, fontSize: 9, color: "#9bb6a6" }}>{label}</span>
    </span>
  );
  return (
    <div style={{ borderRadius: 12, padding: "13px 15px", background: "linear-gradient(120deg, rgba(200,255,45,0.07), rgba(200,255,45,0) 70%)", border: "1px solid rgba(200,255,45,0.16)" }}>
      {withMarker ? <div style={{ marginBottom: 9 }}><SectionLabel style={{ letterSpacing: "0.14em" }}>{"// A COMUNIDADE PALPITA"}</SectionLabel></div> : null}
      {total === 0 ? (
        <div style={{ fontFamily: JB, fontSize: 10, color: "#6f8a78" }}>Ainda sem palpites para esta partida.</div>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 9 }}>
            {cell(homePct, homeCode, homeAccent)}
            {cell(drawPct, "EMP", "#c6d4cb")}
            {cell(awayPct, awayCode, awayAccent)}
          </div>
          <div style={{ display: "flex", height: 7, borderRadius: 5, overflow: "hidden", gap: 2 }}>
            <div style={{ width: `${homePct}%`, background: homeAccent }} />
            <div style={{ width: `${drawPct}%`, background: "#3a4a40" }} />
            <div style={{ width: `${awayPct}%`, background: awayAccent }} />
          </div>
        </>
      )}
    </div>
  );
}
