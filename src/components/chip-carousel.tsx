"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ChipGame } from "@/lib/chips";
import { MONO, PulseDot } from "@/components/primitives";

export interface ChipCarouselProps {
  chips: ChipGame[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const chevronStyle: CSSProperties = {
  flex: "0 0 auto",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 32,
  height: 32,
  background: "transparent",
  color: "var(--ink-2)",
  border: "1px solid var(--line-2)",
  borderRadius: 999,
  cursor: "pointer",
};

function chipLabel(chip: ChipGame): string {
  const m = chip.match;
  if (chip.phase === "pre") {
    return `${m.home.abbreviation} vs ${m.away.abbreviation}`;
  }
  return `${m.home.abbreviation} ${m.homeScore ?? 0}–${m.awayScore ?? 0} ${m.away.abbreviation}`;
}

export function ChipCarousel({ chips, selectedId, onSelect }: ChipCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: number) =>
    scrollRef.current?.scrollBy({ left: dir * 280, behavior: "smooth" });

  // Keep the selected chip in view (centered) without scrolling the page.
  useEffect(() => {
    const el = scrollRef.current?.querySelector('[data-active="true"]');
    el?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [selectedId]);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 22 }}>
      <button onClick={() => scroll(-1)} aria-label="Jogos anteriores" style={chevronStyle}>
        <ChevronLeft size={16} />
      </button>
      <div
        ref={scrollRef}
        className="no-scrollbar"
        style={{
          display: "flex",
          gap: 10,
          overflowX: "auto",
          overflowY: "hidden",
          flex: 1,
          scrollBehavior: "smooth",
          padding: "2px",
        }}
      >
        {chips.map((chip) => {
          const active = chip.match.id === selectedId;
          const isPost = chip.phase === "post";
          return (
            <button
              key={chip.match.id}
              data-active={active}
              onClick={() => onSelect(chip.match.id)}
              style={{
                flex: "0 0 auto",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontFamily: MONO,
                fontSize: 13,
                letterSpacing: "0.02em",
                background: active ? "var(--signal)" : "transparent",
                color: active
                  ? "var(--signal-ink)"
                  : isPost
                    ? "var(--ink-3)"
                    : "var(--ink-2)",
                border: `1px solid ${active ? "var(--signal)" : "var(--line-2)"}`,
                borderRadius: 999,
                padding: "8px 14px",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {chip.phase === "live" ? (
                <PulseDot size={6} color={active ? "var(--signal-ink)" : "var(--signal)"} />
              ) : null}
              {chipLabel(chip)}
            </button>
          );
        })}
      </div>
      <button onClick={() => scroll(1)} aria-label="Próximos jogos" style={chevronStyle}>
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
