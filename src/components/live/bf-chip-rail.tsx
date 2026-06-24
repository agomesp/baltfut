"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type { ChipGame } from "@/lib/chips";
import { JB } from "@/components/live/bf-ui";

function chipLabel(chip: ChipGame): string {
  const m = chip.match;
  if (chip.phase === "pre") return `${m.home.abbreviation} vs ${m.away.abbreviation}`;
  return `${m.home.abbreviation} ${m.homeScore ?? 0}–${m.awayScore ?? 0} ${m.away.abbreviation}`;
}

const GREEN = "#2ecd66";
const EDGE_MASK = "linear-gradient(90deg,transparent,#000 9%,#000 91%,transparent)";

/** The centered, mask-faded match selector rail (v3 redesign). */
export function BfChipRail({ chips, selectedId, onSelect, releasedIds }: { chips: ChipGame[]; selectedId: string | null; onSelect: (id: string) => void; releasedIds: Set<string> }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // Track whether the rail overflows and which end it's parked at, so the arrows
  // and edge-fade only show when there's actually somewhere to scroll.
  const [overflowing, setOverflowing] = useState(false);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setOverflowing(max > 2);
    setAtStart(el.scrollLeft <= 1);
    setAtEnd(el.scrollLeft >= max - 1);
  }, []);

  useEffect(() => {
    measure();
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, chips.length]);

  // Keep the selected chip in view (centered), without scrolling the page. Set
  // scrollLeft directly — programmatic smooth scrolling is unreliable here.
  useEffect(() => {
    const el = scrollRef.current;
    const active = el?.querySelector<HTMLElement>('[data-active="true"]');
    if (el && active) {
      el.scrollLeft = active.offsetLeft - (el.clientWidth - active.clientWidth) / 2;
    }
    measure();
  }, [selectedId, measure, chips.length]);

  // Page the rail by ~70% of its width. scrollLeft is set directly (instant)
  // because scrollBy({behavior:"smooth"}) is a no-op in some engines/contexts.
  const scroll = useCallback(
    (dir: number) => {
      const el = scrollRef.current;
      if (!el) return;
      const max = el.scrollWidth - el.clientWidth;
      const page = Math.max(240, el.clientWidth * 0.7);
      el.scrollLeft = Math.max(0, Math.min(max, el.scrollLeft + dir * page));
      measure();
    },
    [measure],
  );

  const canPrev = overflowing && !atStart;
  const canNext = overflowing && !atEnd;

  const arrow = (enabled: boolean): CSSProperties => ({
    flex: "none",
    width: 28,
    height: 28,
    borderRadius: "50%",
    border: "1px solid rgba(255,255,255,0.16)",
    background: "transparent",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#9bb6a6",
    fontSize: 13,
    cursor: enabled ? "pointer" : "default",
    opacity: enabled ? 1 : 0.28,
    transition: "opacity .2s",
  });

  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 10, borderTop: "1px solid rgba(255,255,255,0.07)", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "9px 0", flex: "none" }}>
      <button aria-label="Jogos anteriores" disabled={!canPrev} onClick={() => scroll(-1)} style={arrow(canPrev)}>‹</button>
      <div style={{ position: "relative", flex: 1, minWidth: 0, overflow: "hidden", WebkitMaskImage: overflowing ? EDGE_MASK : undefined, maskImage: overflowing ? EDGE_MASK : undefined }}>
        <div ref={scrollRef} className="no-scrollbar" onScroll={measure} style={{ display: "flex", gap: 8, justifyContent: overflowing ? "flex-start" : "center", overflowX: "auto", padding: "2px 6px" }}>
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
                style={{ flex: "none", display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, fontFamily: JB, fontSize: 11, whiteSpace: "nowrap", cursor: "pointer", background: bg, border, color }}
              >
                {dot ? <span style={{ width: 6, height: 6, borderRadius: "50%", background: dot, animation: isLive && !active ? "bfpulse 1.5s infinite" : undefined }} /> : null}
                {chipLabel(chip)}
              </button>
            );
          })}
        </div>
      </div>
      <button aria-label="Próximos jogos" disabled={!canNext} onClick={() => scroll(1)} style={arrow(canNext)}>›</button>
    </div>
  );
}
