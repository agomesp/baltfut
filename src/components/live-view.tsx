"use client";

import { useEffect, useRef } from "react";
import type { Match, MatchLineups } from "@/lib/espn";
import { supabaseCastVote, type VoteEntry } from "@/lib/votes";
import type { ChipGame, ChipPhase } from "@/lib/chips";
import { useNow } from "@/lib/use-now";
import { communityConsensus } from "@/lib/consensus";
import { classifyLivePalpites } from "@/lib/live-palpites";
import { palpiteFormOpen, palpiteDeadline } from "@/lib/palpite";
import { Reactions } from "@/components/reactions";
import { RbStoreStrip } from "@/components/live/rb-store-strip";
import { BfChipRail } from "@/components/live/bf-chip-rail";
import { HeroWithCinematic } from "@/components/live/hero-with-cinematic";
import { CommunityBar } from "@/components/live/community-bar";
import { PalpiteBreakdown } from "@/components/live/palpite-breakdown";
import { RankingSubs } from "@/components/live/ranking-subs";
import { LiveDuoCard } from "@/components/live/live-duo-card";
import { PreMatchPanel, DuoGameCard } from "@/components/live/prematch-panel";
import { LineupPanel } from "@/components/live/lineup-panel";
import { PalpiteForm, NameField, useNameLock } from "@/components/live/palpite-form";
import { JB, LIME, teamAccent } from "@/components/live/bf-ui";
import { decideConcurrent } from "@/lib/concurrent-games";
import { useIsNarrow } from "@/lib/use-is-narrow";

/** A match's display phase (pre / live / post). */
function matchPhase(m: Match): ChipPhase {
  return m.isLive ? "live" : m.state === "post" ? "post" : "pre";
}

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
      // Hidden on phones (the bf-streamer-only rule): it's a fixed bottom-left
      // chip that would overlap the stacked cards, and each live card already
      // carries its own "AO VIVO NA K" badge inline.
      className="bf-streamer-only"
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
  releasedIds,
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
  releasedIds: Set<string>;
}) {
  const now = useNow(1000);
  const narrow = useIsNarrow();
  const homeCode = match.home.abbreviation;
  const awayCode = match.away.abbreviation;
  const current = { home: match.homeScore ?? 0, away: match.awayScore ?? 0 };
  const final = phase === "post";
  const breakdown = classifyLivePalpites(entries, current, final);
  const consensus = communityConsensus(entries);
  const formOpen = phase === "live" && palpiteFormOpen(match, releasedIds, now);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 11, flex: 1, minHeight: 0 }}>
      <HeroWithCinematic match={match} subs={lineups?.subs ?? []} />
      <div style={{ display: "flex", flexDirection: narrow ? "column" : "row", gap: 12, flex: 1, minHeight: 0 }}>
        <div style={{ flex: narrow ? "none" : 1.5, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", gap: 10 }}>
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
        <div style={{ flex: narrow ? "none" : 0.82, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          <CommunityBar consensus={consensus} homeCode={homeCode} awayCode={awayCode} homeAccent={teamAccent(homeCode)} awayAccent={teamAccent(awayCode)} />
          <RankingSubs entries={allEntries} matches={matches} variant={narrow ? "column" : "grid"} style={narrow ? { flex: "none" } : { flex: 1, minHeight: 0 }} />
        </div>
      </div>
    </div>
  );
}

/**
 * Two concurrent games side by side + a full-height ranking column. Each game
 * renders by its own phase: a live/finished game shows its live card; an
 * upcoming-but-released game (e.g. the next match while this one is live) shows
 * a submittable palpite form, so you can predict it before it kicks off — then
 * it flips to a live card at kickoff. When any card is a form, a shared name
 * field sits above the pair (mirrors the pre-match duo).
 */
function DuoStage({ games, allEntries, matches, groupByTeam, releasedIds, onVoted }: { games: Match[]; allEntries: VoteEntry[]; matches: Match[]; groupByTeam: Record<string, string>; releasedIds: Set<string>; onVoted: () => void }) {
  const narrow = useIsNarrow();
  const now = useNow(1000);
  const { name, setName, locked, confirm, unlock } = useNameLock();
  // A card shows the palpite form whenever palpites are OPEN for it — pre-match,
  // and through the first 5 live minutes (kickoff+grace). So a game that kicks
  // off keeps its form for those 5 minutes here, exactly like the 1-game view;
  // after the grace it falls back to the live card.
  const isForm = (m: Match) => palpiteFormOpen(m, releasedIds, now);
  const anyForm = games.some(isForm);

  const card = (m: Match) => {
    const entries = allEntries.filter((e) => e.matchId === m.id);
    return isForm(m) ? (
      <DuoGameCard key={m.id} match={m} entries={entries} groupByTeam={groupByTeam} name={name} confirm={confirm} released borderColor="rgba(200,255,45,0.18)" transport={supabaseCastVote} onVoted={onVoted} />
    ) : (
      <LiveDuoCard key={m.id} match={m} entries={entries} groupLabel={groupVenueLabel(m, groupByTeam)} />
    );
  };

  const ranking = <RankingSubs entries={allEntries} matches={matches} variant="column" style={{ flex: "none", width: narrow ? "100%" : 250 }} />;

  // Both live (or finished): the original inline layout, unchanged.
  if (!anyForm) {
    return (
      <div style={{ display: "flex", flexDirection: narrow ? "column" : "row", gap: 12, flex: 1, minHeight: 0 }}>
        {games.map(card)}
        {ranking}
      </div>
    );
  }

  // Mixed: a live game beside the upcoming game's palpite form, shared name field.
  return (
    <div style={{ display: "flex", flexDirection: narrow ? "column" : "row", gap: 12, flex: 1, minHeight: 0 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: narrow ? "none" : 1, minWidth: 0, minHeight: 0 }}>
        <div style={{ flex: "none", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16, borderRadius: 14, border: "1px solid rgba(200,255,45,0.16)", background: "rgba(255,255,255,0.02)", padding: "12px 20px" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <NameField name={name} setName={setName} locked={locked} onUnlock={unlock} />
          </div>
          <span style={{ flex: "none", fontFamily: JB, fontSize: 9, color: "#6f8a78" }}>palpites abertos · feche antes de 5 min de jogo</span>
        </div>
        <div style={{ flex: narrow ? "none" : 1, minHeight: 0, display: "flex", flexDirection: narrow ? "column" : "row", gap: 12 }}>
          {games.map(card)}
        </div>
      </div>
      {ranking}
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
}: LiveViewProps) {
  const now = useNow(15_000);
  const selected = chips.find((c) => c.match.id === selectedId) ?? chips[0];

  // Auto-decide 1 vs 2 concurrent games. Ticks with `now`, so the pair opens 10
  // min before an overlapping game and collapses to the survivor when one ends.
  const decision = selected ? decideConcurrent(selected.match, matches, now) : null;
  const primary = decision?.primary ?? null;
  const partner = decision?.partner ?? null;
  const primaryPhase = primary ? matchPhase(primary) : undefined;
  // Palpites for the shown game: the fresh `entries` feed when it's the selected
  // chip, else filtered from the all-matches feed (e.g. after following a survivor).
  const primaryEntries =
    primary && selected && primary.id === selected.match.id
      ? entries
      : allEntries.filter((e) => e.matchId === primary?.id);

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
  }, [primary?.id, partner?.id, primaryPhase]);

  if (!selected || !primary) {
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
      <Reactions matchId={primary.id} />
      <KickLiveChip />
      <div ref={fillRef} style={{ display: "flex", flexDirection: "column", gap: 11, minHeight: 0 }}>
        <BfChipRail chips={chips} selectedId={selected.match.id} onSelect={onSelect} releasedIds={releasedIds} />

        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          {primaryPhase === "pre" ? (
            <PreMatchPanel
              match={primary}
              second={partner}
              entries={primaryEntries}
              secondEntries={partner ? allEntries.filter((e) => e.matchId === partner.id) : []}
              allEntries={allEntries}
              matches={matches}
              groupByTeam={groupByTeam}
              releasedIds={releasedIds}
              onVoted={onVoted}
            />
          ) : partner ? (
            <DuoStage games={[primary, partner]} allEntries={allEntries} matches={matches} groupByTeam={groupByTeam} releasedIds={releasedIds} onVoted={onVoted} />
          ) : (
            <PlacarStage
              match={primary}
              phase={primaryPhase!}
              entries={primaryEntries}
              allEntries={allEntries}
              matches={matches}
              panel={panel}
              onPanel={onPanel}
              lineups={lineups}
              onVoted={onVoted}
              followCode={followCode}
              releasedIds={releasedIds}
            />
          )}
        </div>

        <RbStoreStrip height={54} />
      </div>
    </section>
  );
}
