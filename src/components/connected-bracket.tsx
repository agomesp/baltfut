"use client";

import { Fragment, type ReactNode } from "react";
import { ROUND_SIZES, toBracketOrder } from "@/lib/bracket-shape";

/** One knockout round handed to the bracket: a header label + the tie cards in
 *  ORIGINAL order (R32 by kickoff, later rounds by wiring index). */
export interface BracketRound {
  key: string;
  label: ReactNode;
  items: ReactNode[];
}

export interface ConnectedBracketProps {
  /** Main rounds only, 32-avos → final. Champion / 3º lugar go in `trailing`. */
  rounds: BracketRound[];
  colWidth: number;
  /** Vertical space per round-of-32 tie; the whole bracket is 16× this tall. */
  unitHeight: number;
  gap: number;
  connectorColor?: string;
  /** Extra column after the final (champion, 3rd place): `label` sits in the
   *  header row, `content` is centred vertically alongside the final. */
  trailing?: { width: number; label?: ReactNode; content: ReactNode };
}

const LABEL_H = 30;

/**
 * A bracket that draws connector lines from each tie to the next round's tie.
 * Each round is reordered into planar bracket order (so a tie's two feeders sit
 * adjacent), cards are centred on their slot, and an SVG layer links feeder →
 * target with a smooth curve. Falls back to plain stacked columns until the
 * bracket is fully drawn (all five rounds at their expected sizes).
 */
export function ConnectedBracket({
  rounds,
  colWidth,
  unitHeight,
  gap,
  connectorColor = "rgba(255,255,255,0.13)",
  trailing,
}: ConnectedBracketProps) {
  const full =
    rounds.length === ROUND_SIZES.length &&
    rounds.every((r, i) => r.items.length === ROUND_SIZES[i]);

  if (!full) {
    // Not fully drawn yet — stack each column, no connectors.
    return (
      <div style={{ display: "flex", gap, alignItems: "flex-start" }}>
        {rounds.map((r) => (
          <div key={r.key} style={{ flex: `0 0 ${colWidth}px`, display: "flex", flexDirection: "column" }}>
            {r.label}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {r.items.map((it, i) => (
                <Fragment key={i}>{it}</Fragment>
              ))}
            </div>
          </div>
        ))}
        {trailing ? (
          <div style={{ flex: `0 0 ${trailing.width}px`, display: "flex", flexDirection: "column" }}>
            {trailing.label}
            {trailing.content}
          </div>
        ) : null}
      </div>
    );
  }

  const totalH = ROUND_SIZES[0] * unitHeight;
  const step = colWidth + gap;
  const colX = (r: number) => r * step;
  const centerY = (r: number, slot: number) => (slot + 0.5) * (totalH / ROUND_SIZES[r]);
  const bracketW = rounds.length * step - gap;
  const width = bracketW + (trailing ? gap + trailing.width : 0);

  const ordered = rounds.map((r, i) => toBracketOrder(r.items, i));

  // Feeder slot i (round r) → target slot floor(i/2) (round r+1); smooth S-curve.
  const paths: string[] = [];
  for (let r = 0; r < rounds.length - 1; r++) {
    for (let i = 0; i < ROUND_SIZES[r]; i++) {
      const x1 = colX(r) + colWidth;
      const y1 = centerY(r, i);
      const x2 = colX(r + 1);
      const y2 = centerY(r + 1, Math.floor(i / 2));
      const midX = (x1 + x2) / 2;
      paths.push(`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`);
    }
  }

  return (
    <div style={{ position: "relative", width, minWidth: "max-content" }}>
      {/* Column headers */}
      <div style={{ position: "relative", height: LABEL_H }}>
        {rounds.map((r, i) => (
          <div key={r.key} style={{ position: "absolute", left: colX(i), width: colWidth }}>
            {r.label}
          </div>
        ))}
        {trailing?.label ? (
          <div style={{ position: "absolute", left: bracketW + gap, width: trailing.width }}>
            {trailing.label}
          </div>
        ) : null}
      </div>

      {/* Ties + connectors */}
      <div style={{ position: "relative", height: totalH }}>
        <svg width={width} height={totalH} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} aria-hidden>
          {paths.map((d, i) => (
            <path key={i} d={d} fill="none" stroke={connectorColor} strokeWidth={1.5} />
          ))}
        </svg>
        {ordered.map((items, r) =>
          items.map((card, i) => (
            <div
              key={`${r}-${i}`}
              style={{ position: "absolute", left: colX(r), top: centerY(r, i), width: colWidth, transform: "translateY(-50%)" }}
            >
              {card}
            </div>
          )),
        )}
        {trailing ? (
          <div
            style={{
              position: "absolute",
              left: bracketW + gap,
              top: 0,
              height: totalH,
              width: trailing.width,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            {trailing.content}
          </div>
        ) : null}
      </div>
    </div>
  );
}
