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
  bare = false,
  label = "// A COMUNIDADE PALPITA",
}: {
  consensus: Consensus;
  homeCode: string;
  awayCode: string;
  homeAccent: string;
  awayAccent: string;
  withMarker?: boolean;
  /** Drop the card border/background/padding (sit directly inside a host card). */
  bare?: boolean;
  /** Section-label text (default "// A COMUNIDADE PALPITA"). */
  label?: string;
}) {
  const { homePct, drawPct, awayPct, total } = consensus;
  const pctFont = bare ? 16 : 20;
  const barH = bare ? 5 : 6;
  const gap = bare ? 5 : 7;
  const cell = (pct: number, lbl: string, color: string) => (
    <span style={{ color }}>
      <b style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: pctFont }}>{pct}%</b>{" "}
      <span style={{ fontFamily: JB, fontSize: 8.5, color: "#9bb6a6" }}>{lbl}</span>
    </span>
  );
  const bars =
    total === 0 ? (
      <div style={{ fontFamily: JB, fontSize: 9.5, color: "#6f8a78" }}>Ainda sem palpites para esta partida.</div>
    ) : (
      <>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: gap }}>
          {cell(homePct, homeCode, homeAccent)}
          {cell(drawPct, "EMP", "#c6d4cb")}
          {cell(awayPct, awayCode, awayAccent)}
        </div>
        <div style={{ display: "flex", height: barH, borderRadius: 5, overflow: "hidden", gap: 2 }}>
          <div style={{ width: `${homePct}%`, background: homeAccent }} />
          <div style={{ width: `${drawPct}%`, background: "#3a4a40" }} />
          <div style={{ width: `${awayPct}%`, background: awayAccent }} />
        </div>
      </>
    );

  // Bare: the label sits on the LEFT, inline with the percentages/bar.
  if (bare) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {withMarker ? (
          <span style={{ flex: "none", fontFamily: JB, fontSize: 8.5, letterSpacing: "0.14em", color: "#9ef01f", whiteSpace: "nowrap" }}>{label}:</span>
        ) : null}
        <div style={{ flex: 1, minWidth: 0 }}>{bars}</div>
      </div>
    );
  }

  return (
    <div style={{ borderRadius: 11, padding: "10px 13px", background: "linear-gradient(120deg, rgba(200,255,45,0.07), rgba(200,255,45,0) 70%)", border: "1px solid rgba(200,255,45,0.16)" }}>
      {withMarker ? <div style={{ marginBottom: gap }}><SectionLabel style={{ letterSpacing: "0.14em" }}>{label}</SectionLabel></div> : null}
      {bars}
    </div>
  );
}
