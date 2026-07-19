import { motion } from "framer-motion";
import type { Consensus } from "@/lib/consensus";
import { JB, SAIRA, SectionLabel } from "@/components/live/bf-ui";
import { RollingNumber } from "@/components/live/fx";

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
      {/* The split shifts every time a palpite lands — roll the digit rather
          than swapping it, so the movement itself reads as "someone just voted". */}
      <b style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: pctFont }}>
        <RollingNumber value={pct} />%
      </b>{" "}
      <span style={{ fontFamily: JB, fontSize: 8.5, color: "#9bb6a6" }}>{lbl}</span>
    </span>
  );
  // Segments glide to their new share instead of snapping. Width (not scaleX):
  // three segments share one flex row, and scaling would distort the colours'
  // edges against each other.
  const seg = (pct: number, background: string) => (
    <motion.div
      animate={{ width: `${pct}%` }}
      initial={false}
      transition={{ type: "spring", stiffness: 120, damping: 22, mass: 0.8 }}
      style={{ background }}
    />
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
          {seg(homePct, homeAccent)}
          {seg(drawPct, "#3a4a40")}
          {seg(awayPct, awayAccent)}
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
