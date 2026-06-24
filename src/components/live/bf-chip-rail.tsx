"use client";

import { useEffect, useRef } from "react";
import type { ChipGame } from "@/lib/chips";
import { JB } from "@/components/live/bf-ui";

function chipLabel(chip: ChipGame): string {
  const m = chip.match;
  if (chip.phase === "pre") return `${m.home.abbreviation} vs ${m.away.abbreviation}`;
  return `${m.home.abbreviation} ${m.homeScore ?? 0}–${m.awayScore ?? 0} ${m.away.abbreviation}`;
}

const GREEN = "#2ecd66";

/** The centered, mask-faded match selector rail (v3 redesign). */
export function BfChipRail({ chips, selectedId, onSelect, releasedIds }: { chips: ChipGame[]; selectedId: string | null; onSelect: (id: string) => void; releasedIds: Set<string> }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => scrollRef.current?.scrollBy({ left: dir * 280, behavior: "smooth" });

  useEffect(() => {
    scrollRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [selectedId]);

  const arrow = {
    flex: "none" as const,
    width: 30,
    height: 30,
    borderRadius: "50%",
    border: "1px solid rgba(255,255,255,0.16)",
    background: "transparent",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#9bb6a6",
    fontSize: 14,
    cursor: "pointer",
  };

  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 12, borderTop: "1px solid rgba(255,255,255,0.07)", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "11px 0", flex: "none" }}>
      <button aria-label="Jogos anteriores" onClick={() => scroll(-1)} style={arrow}>‹</button>
      <div style={{ position: "relative", flex: 1, minWidth: 0, overflow: "hidden", WebkitMaskImage: "linear-gradient(90deg,transparent,#000 9%,#000 91%,transparent)", maskImage: "linear-gradient(90deg,transparent,#000 9%,#000 91%,transparent)" }}>
        <div ref={scrollRef} className="no-scrollbar" style={{ display: "flex", gap: 9, justifyContent: "flex-start", overflowX: "auto", padding: "2px 6px" }}>
          {chips.map((chip) => {
            const active = chip.match.id === selectedId;
            const isLive = chip.phase === "live";
            const isNext = chip.phase === "pre" && releasedIds.has(chip.match.id);
            const isDone = chip.phase === "post";
            let bg = "transparent";
            let border = "1px solid rgba(255,255,255,0.10)";
            let color = isDone ? "#6f8a78" : "#cfd3ce";
            let dot = "";
            if (active) {
              bg = GREEN;
              border = `1px solid ${GREEN}`;
              color = "#06160c";
              dot = "#06160c";
            } else if (isLive) {
              border = `1px dashed ${GREEN}`;
              color = "#bfeccd";
              bg = "rgba(46,205,102,0.06)";
              dot = GREEN;
            } else if (isNext) {
              border = "1px solid rgba(255,255,255,0.16)";
              color = "#cfd3ce";
            }
            return (
              <button
                key={chip.match.id}
                data-active={active}
                onClick={() => onSelect(chip.match.id)}
                style={{ flex: "none", display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 15px", borderRadius: 8, fontFamily: JB, fontSize: 12, whiteSpace: "nowrap", cursor: "pointer", background: bg, border, color }}
              >
                {dot ? <span style={{ width: 6, height: 6, borderRadius: "50%", background: dot, animation: isLive && !active ? "bfpulse 1.5s infinite" : undefined }} /> : null}
                {chipLabel(chip)}
              </button>
            );
          })}
        </div>
      </div>
      <button aria-label="Próximos jogos" onClick={() => scroll(1)} style={arrow}>›</button>
    </div>
  );
}
