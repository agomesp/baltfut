"use client";

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import type { Match, MatchLineups } from "@/lib/espn";
import { matchShootout } from "@/lib/espn";
import { supabaseCastVote, type VoteEntry } from "@/lib/votes";
import type { ChipGame, ChipPhase } from "@/lib/chips";
import { useNow } from "@/lib/use-now";
import { wcProgress } from "@/lib/wc-progress";
import { communityConsensus } from "@/lib/consensus";
import { classifyLivePalpites } from "@/lib/live-palpites";
import { palpiteFormVisible, effectiveDeadline } from "@/lib/palpite";
import { penVoteVisible } from "@shared/deadline";
import { Reactions } from "@/components/reactions";
import { RbStoreStrip } from "@/components/live/rb-store-strip";
import { BfChipRail } from "@/components/live/bf-chip-rail";
import { HeroWithCinematic } from "@/components/live/hero-with-cinematic";
import { CommunityBar } from "@/components/live/community-bar";
import { PalpiteBreakdown } from "@/components/live/palpite-breakdown";
import { RankingSubs } from "@/components/live/ranking-subs";
import type { BracketEntry } from "@/lib/bracket-votes";
import { IaVsVoce } from "@/components/live/ia-vs-voce";
import { LiveDuoCard } from "@/components/live/live-duo-card";
import { PreMatchPanel, DuoGameCard } from "@/components/live/prematch-panel";
import { LineupPanel } from "@/components/live/lineup-panel";
import { PalpiteForm, PenVote, NameField, useNameLock, type PenOverride } from "@/components/live/palpite-form";
import { JB, LIME, teamAccent } from "@/components/live/bf-ui";
import { decideConcurrent } from "@/lib/concurrent-games";
import { useIsNarrow } from "@/lib/use-is-narrow";
import { useMyName } from "@/lib/use-my-name";
import { useSubRanks } from "@/lib/use-sub-ranks";
import { scenarioFromMatch } from "@/lib/showpiece/from-match";
import { ShowpieceMatchV2 } from "@/components/showpiece/showpiece-match-v2";
import { subscribePromoDisplay, isPromoDisplay } from "@/lib/promo-display";
import { LivePromoView } from "@/components/live/live-promo-view";
import type { MatchResult } from "@/lib/ranking";

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
  results,
  brackets,
  panel,
  onPanel,
  lineups,
  onVoted,
  followCode,
  releasedIds,
  penOverride,
  palpiteOpenUntil,
}: {
  match: Match;
  phase: ChipPhase;
  entries: VoteEntry[];
  allEntries: VoteEntry[];
  matches: Match[];
  results?: Record<string, MatchResult>;
  brackets?: BracketEntry[];
  panel: "predict" | "lineup";
  onPanel: (p: "predict" | "lineup") => void;
  lineups: MatchLineups | null;
  onVoted: () => void;
  followCode: string | null;
  releasedIds: Set<string>;
  penOverride: PenOverride;
  palpiteOpenUntil: number | null;
}) {
  const now = useNow(1000);
  const narrow = useIsNarrow();
  const homeCode = match.home.abbreviation;
  const awayCode = match.away.abbreviation;
  const hs = match.homeScore ?? 0;
  const as = match.awayScore ?? 0;
  const final = phase === "post";
  // Keyed on the PRIMITIVE score (hs/as), not a `current` object — so it stays
  // cached on idle 1s ticks but recomputes the instant a goal lands (the worker
  // replaces `matches` → a new score value flows in here). `consensus` depends
  // only on the palpites, so a goal correctly leaves it untouched.
  const breakdown = useMemo(() => classifyLivePalpites(entries, { home: hs, away: as }, final), [entries, hs, as, final]);
  const consensus = useMemo(() => communityConsensus(entries), [entries]);
  // A manual admin window (palpiteOpenUntil) can keep the form open past the grace
  // — or REOPEN a finished match — so it bypasses the live-only phase gate too.
  const overrideOpen = palpiteOpenUntil != null && now <= palpiteOpenUntil;
  const formOpen = (phase === "live" || overrideOpen) && palpiteFormVisible(match, releasedIds, now, palpiteOpenUntil);
  // The pen-winner split shows only once the pen UI goes live (≥110', 10 min before
  // pens) — or when the admin manually liberated it; mirrors the PenVote picker gate.
  const penVisible = penOverride === "open" || penVoteVisible({ state: match.state, detail: match.statusDetail, clock: match.displayClock });
  // Streamer promo board — swaps ONLY the palpites area (the score hero stays) and
  // ONLY while the match is live. Toggled from the Modo Streamer PiP.
  const promoOn = useSyncExternalStore(subscribePromoDisplay, isPromoDisplay, () => false);
  const showPromos = promoOn && phase === "live";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 11, flex: 1, minHeight: 0 }}>
      {/* The knockout pen-winner picker rides as a tall column to the RIGHT of the
          placar so it's prominent during the live game (self-hides when N/A). */}
      {narrow ? (
        <>
          <HeroWithCinematic match={match} subs={lineups?.subs ?? []} />
          <PenVote match={match} entries={entries} onVoted={onVoted} override={penOverride} />
        </>
      ) : (
        <div style={{ display: "flex", gap: 11, alignItems: "stretch", flex: "none", minHeight: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <HeroWithCinematic match={match} subs={lineups?.subs ?? []} />
          </div>
          <PenVote variant="hero" match={match} entries={entries} onVoted={onVoted} override={penOverride} />
        </div>
      )}
      {showPromos ? (
        <LivePromoView />
      ) : (
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
                  <PalpiteForm match={match} entries={entries} closesAt={effectiveDeadline(match.startsAt, palpiteOpenUntil)} onVoted={onVoted} />
                </div>
              ) : null}
              <PalpiteBreakdown breakdown={breakdown} homeCode={homeCode} awayCode={awayCode} total={entries.length} closed={phase !== "live"} penResult={matchShootout(match)} penVisible={penVisible} />
            </>
          )}
        </div>
        <div style={{ flex: narrow ? "none" : 0.82, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          <IaVsVoce entries={allEntries} matches={matches} style={{ flex: "none" }} />
          <CommunityBar consensus={consensus} homeCode={homeCode} awayCode={awayCode} homeAccent={teamAccent(homeCode)} awayAccent={teamAccent(awayCode)} />
          <RankingSubs entries={allEntries} matches={matches} results={results} brackets={brackets} variant={narrow ? "column" : "grid"} style={narrow ? { flex: "none" } : { flex: 1, minHeight: 0 }} />
        </div>
      </div>
      )}
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
function DuoStage({ games, allEntries, matches, results, brackets, groupByTeam, releasedIds, palpiteOverrides, onVoted }: { games: Match[]; allEntries: VoteEntry[]; matches: Match[]; results?: Record<string, MatchResult>; brackets?: BracketEntry[]; groupByTeam: Record<string, string>; releasedIds: Set<string>; palpiteOverrides: Record<string, number>; onVoted: () => void }) {
  const narrow = useIsNarrow();
  const now = useNow(1000);
  const { name, setName, locked, confirm, unlock } = useNameLock();
  // A card shows the palpite form whenever palpites are OPEN for it — pre-match,
  // and through the first 5 live minutes (kickoff+grace). So a game that kicks
  // off keeps its form for those 5 minutes here, exactly like the 1-game view;
  // after the grace it falls back to the live card.
  const ovr = (m: Match) => palpiteOverrides[m.id] ?? null;
  const isForm = (m: Match) => palpiteFormVisible(m, releasedIds, now, ovr(m));
  const anyForm = games.some(isForm);

  const card = (m: Match) => {
    const entries = allEntries.filter((e) => e.matchId === m.id);
    return isForm(m) ? (
      <DuoGameCard key={m.id} match={m} entries={entries} groupByTeam={groupByTeam} name={name} confirm={confirm} released openUntil={ovr(m)} borderColor="rgba(200,255,45,0.18)" transport={supabaseCastVote} onVoted={onVoted} />
    ) : (
      <LiveDuoCard key={m.id} match={m} entries={entries} groupLabel={groupVenueLabel(m, groupByTeam)} />
    );
  };

  const ranking = <RankingSubs entries={allEntries} matches={matches} results={results} brackets={brackets} variant="column" style={{ flex: "none", width: narrow ? "100%" : 250 }} />;

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
  /** Durable finished-match scores from the DB — the ranking grades on these
   *  first, so ESPN dropping/changing an old result can't erase wins. */
  matchResults?: Record<string, MatchResult>;
  /** Saved knockout brackets — 0.2 per correct winner folds into the ranking. */
  brackets?: BracketEntry[];
  onVoted: () => void;
  followCode: string | null;
  groupByTeam: Record<string, string>;
  releasedIds: Set<string>;
  penOverride?: PenOverride;
  /** Manual per-match palpite windows from the admin: match_id → openUntil (ms). */
  palpiteOverrides?: Record<string, number>;
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
  matchResults,
  brackets,
  onVoted,
  followCode,
  groupByTeam,
  releasedIds,
  penOverride = null,
  palpiteOverrides = {},
}: LiveViewProps) {
  const now = useNow(15_000);
  const wc = wcProgress(now);
  const selected = chips.find((c) => c.match.id === selectedId) ?? chips[0];

  // Auto-decide 1 vs 2 concurrent games. Ticks with `now`, so the pair opens 10
  // min before an overlapping game and collapses to the survivor when one ends.
  const decision = selected ? decideConcurrent(selected.match, matches, now) : null;
  const primary = decision?.primary ?? null;
  const partner = decision?.partner ?? null;
  const primaryPhase = primary ? matchPhase(primary) : undefined;
  // The two marquee ties (the final and the 3rd-place match) get their own
  // bespoke stage instead of the normal pre/live panels — recognised straight
  // off ESPN's stage slug, so it lights up on its own when the tie comes round.
  const showpiece = useMemo(() => (primary ? scenarioFromMatch(primary, matches) : null), [primary, matches]);
  const showpieceNarrow = useIsNarrow();
  const myName = useMyName();
  const subRanks = useSubRanks(allEntries, matches, matchResults, brackets);
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

  // Compact masthead: brand block (column) on the left of the match rail, the
  // entertainment-only notice pinned top-right above it. Replaces the global header
  // on the live screen (shorter page) and renders even with no game selected.
  const masthead = (
    <div style={{ display: "flex", alignItems: "stretch", gap: 16, flex: "none", flexWrap: "wrap" }}>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 3, flex: "none" }}>
        <span style={{ fontFamily: "var(--font-bric)", fontWeight: 800, fontSize: 22, letterSpacing: "-0.02em", color: "#f1f7f0", lineHeight: 1 }}>BaltFut</span>
        <span style={{ fontFamily: JB, fontSize: 8, letterSpacing: "0.03em", color: "#7d9a86", lineHeight: 1.35, whiteSpace: "nowrap" }}>
          COPA DO MUNDO <span style={{ color: "var(--bf-lime)" }}>26.</span>
        </span>
        <span style={{ fontFamily: JB, fontSize: 8, letterSpacing: "0.03em", color: "#7d9a86", lineHeight: 1.35, whiteSpace: "nowrap" }}>{wc.pct}% CONCLUÍDA</span>
      </div>
      <div style={{ flex: "1 1 360px", minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <span style={{ fontFamily: JB, fontSize: 8, letterSpacing: "0.03em", color: "var(--ink-3)" }}>
            Palpites grátis · sem cadastro · sem premiação · apenas para diversão.
          </span>
        </div>
        <BfChipRail chips={chips} selectedId={selected?.match.id ?? null} onSelect={onSelect} releasedIds={releasedIds} />
      </div>
    </div>
  );

  if (!selected || !primary) {
    return (
      <section>
        <div ref={fillRef} style={{ display: "flex", flexDirection: "column", gap: 11, minHeight: 0 }}>
          {masthead}
          <div style={{ flex: 1, minHeight: 0 }}>
            <div style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", padding: "40px 24px", textAlign: "center" }}>
              <div style={{ fontFamily: "var(--font-bric)", fontWeight: 800, fontSize: 24, color: "#cfd9d1" }}>Nenhum jogo por enquanto</div>
              <div style={{ fontSize: 14, color: "#6f8a78", marginTop: 8 }}>Volte perto dos próximos jogos.</div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section>
      <Reactions matchId={primary.id} />
      <KickLiveChip />
      <div ref={fillRef} style={{ display: "flex", flexDirection: "column", gap: 11, minHeight: 0 }}>
        {masthead}

        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          {showpiece ? (
            <ShowpieceMatchV2
              scenario={showpiece}
              narrow={showpieceNarrow}
              fill
              entries={primaryEntries}
              ranks={subRanks}
              myName={myName}
              palpiteSlot={primaryPhase === "pre" ? (
                <PalpiteForm
                  match={primary}
                  entries={primaryEntries}
                  closesAt={effectiveDeadline(primary.startsAt, palpiteOverrides[primary.id] ?? null)}
                  released={releasedIds.has(primary.id) || palpiteOverrides[primary.id] != null}
                  onVoted={onVoted}
                  hideCountdown
                />
              ) : undefined}
            />
          ) : primaryPhase === "pre" ? (
            <PreMatchPanel
              match={primary}
              second={partner}
              entries={primaryEntries}
              secondEntries={partner ? allEntries.filter((e) => e.matchId === partner.id) : []}
              allEntries={allEntries}
              matches={matches}
              results={matchResults}
              brackets={brackets}
              groupByTeam={groupByTeam}
              releasedIds={releasedIds}
              palpiteOverrides={palpiteOverrides}
              onVoted={onVoted}
            />
          ) : partner ? (
            <DuoStage games={[primary, partner]} allEntries={allEntries} matches={matches} results={matchResults} brackets={brackets} groupByTeam={groupByTeam} releasedIds={releasedIds} palpiteOverrides={palpiteOverrides} onVoted={onVoted} />
          ) : (
            <PlacarStage
              match={primary}
              phase={primaryPhase!}
              entries={primaryEntries}
              allEntries={allEntries}
              matches={matches}
              results={matchResults}
              brackets={brackets}
              panel={panel}
              onPanel={onPanel}
              lineups={lineups}
              onVoted={onVoted}
              followCode={followCode}
              releasedIds={releasedIds}
              penOverride={penOverride}
              palpiteOpenUntil={palpiteOverrides[primary.id] ?? null}
            />
          )}
        </div>

        <RbStoreStrip height={54} />
      </div>
    </section>
  );
}
