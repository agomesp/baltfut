"use client";

import { useEffect, useRef } from "react";
import type { Match, MatchLineups } from "@/lib/espn";
import type { VoteEntry } from "@/lib/votes";
import type { ChipGame, ChipPhase } from "@/lib/chips";
import { useNow } from "@/lib/use-now";
import { communityConsensus } from "@/lib/consensus";
import { classifyLivePalpites } from "@/lib/live-palpites";
import { isPalpiteOpen, palpiteDeadline } from "@/lib/palpite";
import { Reactions } from "@/components/reactions";
import { RbStoreStrip } from "@/components/live/rb-store-strip";
import { BfChipRail } from "@/components/live/bf-chip-rail";
import { HeroScoreboard } from "@/components/live/hero-scoreboard";
import { CommunityBar } from "@/components/live/community-bar";
import { PalpiteBreakdown } from "@/components/live/palpite-breakdown";
import { RankingSubs } from "@/components/live/ranking-subs";
import { LiveDuoCard } from "@/components/live/live-duo-card";
import { PreMatchPanel } from "@/components/live/prematch-panel";
import { LineupPanel } from "@/components/live/lineup-panel";
import { PalpiteForm } from "@/components/live/palpite-form";
import { JB, LIME, teamAccent } from "@/components/live/bf-ui";

export type LiveMode = "placar" | "duo";

function groupVenueLabel(m: Match, groupByTeam: Record<string, string>): string {
  const g = groupByTeam[m.home.abbreviation] ?? groupByTeam[m.away.abbreviation];
  return [g ? `GRUPO ${g}` : "", m.venue ?? ""].filter(Boolean).join(" · ").toUpperCase();
}

/** "AO VIVO NA [K]" — the streamer's Kick, pinned bottom-left (the design footer-left). */
function KickLiveChip() {
  return (
    <a
      href="https://kick.com/locobaltar"
      target="_blank"
      rel="noopener noreferrer"
      title="Assistir ao vivo na Kick"
      style={{ position: "fixed", left: 16, bottom: 16, zIndex: 56, display: "inline-flex", alignItems: "center", gap: 9, background: "rgba(0,0,0,0.45)", borderRadius: 999, padding: "8px 13px", fontFamily: JB, fontSize: 11, color: "#cbdcd0", textDecoration: "none" }}
    >
      <span className="rec-blink" style={{ width: 7, height: 7, borderRadius: "50%", background: "#ff4d4d" }} />
      AO VIVO NA <span style={{ background: "#53fc18", color: "#000", fontWeight: 800, padding: "1px 5px", borderRadius: 4 }}>K</span>
    </a>
  );
}

function segBtn(active: boolean) {
  return {
    flex: "1 1 0",
    fontFamily: JB,
    fontSize: 10,
    letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
    background: active ? LIME : "transparent",
    color: active ? "#0f1f02" : "#9bb6a6",
    border: active ? `1px solid ${LIME}` : "1px solid rgba(255,255,255,0.12)",
    borderRadius: 8,
    padding: "6px 8px",
    cursor: "pointer",
  };
}

/** PLACAR: hero + (palpites breakdown | escalação) on the left, consensus + ranking on the right. */
function PlacarStage({
  match,
  phase,
  entries,
  allEntries,
  matches,
  panel,
  onPanel,
  lineups,
  onVoted,
  followCode,
  released,
}: {
  match: Match;
  phase: ChipPhase;
  entries: VoteEntry[];
  allEntries: VoteEntry[];
  matches: Match[];
  panel: "predict" | "lineup";
  onPanel: (p: "predict" | "lineup") => void;
  lineups: MatchLineups | null;
  onVoted: () => void;
  followCode: string | null;
  released: boolean;
}) {
  const now = useNow(1000);
  const homeCode = match.home.abbreviation;
  const awayCode = match.away.abbreviation;
  const current = { home: match.homeScore ?? 0, away: match.awayScore ?? 0 };
  const final = phase === "post";
  const breakdown = classifyLivePalpites(entries, current, final);
  const consensus = communityConsensus(entries);
  const formOpen = phase === "live" && released && isPalpiteOpen(palpiteDeadline(match.startsAt), now);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 11, flex: 1, minHeight: 0 }}>
      <HeroScoreboard match={match} />
      <div style={{ display: "flex", gap: 12, flex: 1, minHeight: 0 }}>
        <div style={{ flex: 1.5, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 8, flex: "none" }}>
            <button onClick={() => onPanel("predict")} style={segBtn(panel === "predict")}>Palpites</button>
            <button onClick={() => onPanel("lineup")} style={segBtn(panel === "lineup")}>Escalação</button>
          </div>
          {panel === "lineup" ? (
            <LineupPanel lineups={lineups} followCode={followCode} />
          ) : (
            <>
              {formOpen ? (
                <div style={{ borderRadius: 12, border: "1px solid rgba(200,255,45,0.16)", background: "rgba(255,255,255,0.02)", padding: "14px 16px", flex: "none" }}>
                  <PalpiteForm match={match} entries={entries} closesAt={palpiteDeadline(match.startsAt)} onVoted={onVoted} />
                </div>
              ) : null}
              <PalpiteBreakdown breakdown={breakdown} homeCode={homeCode} awayCode={awayCode} total={entries.length} closed={phase !== "live"} />
            </>
          )}
        </div>
        <div style={{ flex: 0.82, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          <CommunityBar consensus={consensus} homeCode={homeCode} awayCode={awayCode} homeAccent={teamAccent(homeCode)} awayAccent={teamAccent(awayCode)} />
          <RankingSubs entries={allEntries} matches={matches} variant="grid" style={{ flex: 1, minHeight: 0 }} />
        </div>
      </div>
    </div>
  );
}

/** 2 JOGOS: two live cards + a full-height ranking column. */
function DuoStage({ liveMatches, allEntries, matches, groupByTeam }: { liveMatches: Match[]; allEntries: VoteEntry[]; matches: Match[]; groupByTeam: Record<string, string> }) {
  const two = liveMatches.slice(0, 2);
  return (
    <div style={{ display: "flex", gap: 12, flex: 1, minHeight: 0 }}>
      {two.map((m) => (
        <LiveDuoCard key={m.id} match={m} entries={allEntries.filter((e) => e.matchId === m.id)} groupLabel={groupVenueLabel(m, groupByTeam)} />
      ))}
      <RankingSubs entries={allEntries} matches={matches} variant="column" style={{ flex: "none", width: 250 }} />
    </div>
  );
}

export interface LiveViewProps {
  chips: ChipGame[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  panel: "predict" | "lineup";
  onPanel: (p: "predict" | "lineup") => void;
  lineups: MatchLineups | null;
  entries: VoteEntry[];
  allEntries: VoteEntry[];
  matches: Match[];
  onVoted: () => void;
  followCode: string | null;
  groupByTeam: Record<string, string>;
  releasedIds: Set<string>;
  liveMode: LiveMode;
  onLiveMode: (m: LiveMode) => void;
}

export function LiveView({
  chips,
  selectedId,
  onSelect,
  panel,
  onPanel,
  lineups,
  entries,
  allEntries,
  matches,
  onVoted,
  followCode,
  groupByTeam,
  releasedIds,
  liveMode,
  onLiveMode,
}: LiveViewProps) {
  const selected = chips.find((c) => c.match.id === selectedId) ?? chips[0];
  const liveMatches = chips.filter((c) => c.phase === "live").map((c) => c.match);
  const phase = selected?.phase;
  const isPre = phase === "pre";
  // Duo only when a live match is selected (so clicking a finished/upcoming chip
  // still shows that match), mirroring the original auto-split condition.
  const isDuo = phase === "live" && liveMode === "duo" && liveMatches.length >= 2;

  // "2 JOGOS" pre-match pairs the selected game with another kicking off at the
  // SAME time (e.g. the final group round's two simultaneous games), not just the
  // next one. Null → the toggle is disabled when nothing else starts at that moment.
  const upcoming = chips.filter((c) => c.phase === "pre").map((c) => c.match);
  const second =
    isPre && selected
      ? upcoming.find((m) => m.id !== selected.match.id && m.startsAt === selected.match.startsAt) ?? null
      : null;

  // Fill the viewport on wide screens so the stage is a fixed dense dashboard
  // (the design is height:100vh with internal scroll); narrow screens flow + scroll.
  const fillRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = fillRef.current;
    if (!el) return;
    const WIDE_MIN = 1000;
    const BOTTOM_GAP = 74;
    const apply = () => {
      if (window.innerWidth < WIDE_MIN) {
        el.style.height = "";
        el.style.overflow = "";
        return;
      }
      el.style.overflow = "hidden";
      const top = el.getBoundingClientRect().top;
      el.style.height = `${Math.max(360, window.innerHeight - top - BOTTOM_GAP)}px`;
    };
    apply();
    const raf = requestAnimationFrame(apply);
    window.addEventListener("resize", apply);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", apply);
    };
  }, [selected?.match.id, liveMode, isPre, isDuo]);

  if (!selected) {
    return (
      <section>
        <div style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", padding: "40px 24px", textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-bric)", fontWeight: 800, fontSize: 24, color: "#cfd9d1" }}>Nenhum jogo por enquanto</div>
          <div style={{ fontSize: 14, color: "#6f8a78", marginTop: 8 }}>Volte perto dos próximos jogos.</div>
        </div>
      </section>
    );
  }

  return (
    <section>
      <Reactions matchId={selected.match.id} />
      <KickLiveChip />
      <div ref={fillRef} style={{ display: "flex", flexDirection: "column", gap: 11, minHeight: 0 }}>
        <BfChipRail chips={chips} selectedId={selected.match.id} onSelect={onSelect} releasedIds={releasedIds} />

        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          {isPre ? (
            <PreMatchPanel
              match={selected.match}
              second={second}
              entries={entries}
              secondEntries={second ? allEntries.filter((e) => e.matchId === second.id) : []}
              allEntries={allEntries}
              matches={matches}
              groupByTeam={groupByTeam}
              releasedIds={releasedIds}
              mode={liveMode}
              onMode={onLiveMode}
              onVoted={onVoted}
            />
          ) : isDuo ? (
            <DuoStage liveMatches={liveMatches} allEntries={allEntries} matches={matches} groupByTeam={groupByTeam} />
          ) : (
            <PlacarStage
              match={selected.match}
              phase={phase!}
              entries={entries}
              allEntries={allEntries}
              matches={matches}
              panel={panel}
              onPanel={onPanel}
              lineups={lineups}
              onVoted={onVoted}
              followCode={followCode}
              released={releasedIds.has(selected.match.id)}
            />
          )}
        </div>

        <RbStoreStrip height={54} />
      </div>
    </section>
  );
}
