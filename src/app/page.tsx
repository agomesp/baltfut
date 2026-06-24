"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchScoreboard,
  fetchStandings,
  fetchLineups,
  teamGroupMap,
  buildBracket,
  parseScoreboard,
  scoreboardUrl,
  DEFAULT_LEAGUE,
  FIFA_WORLD_DATE_RANGE,
  type Match,
  type Group,
  type MatchLineups,
} from "@/lib/espn";
import { startScoreboardWorker } from "@/lib/scoreboard-worker";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  fetchVoteEntries,
  fetchAllEntries,
  fetchVoteCounts,
  type VoteEntry,
} from "@/lib/votes";
import { buildChipGames, defaultChipId } from "@/lib/chips";
import { releasedMatchIds } from "@/lib/palpite";
import { teamNamePt } from "@/lib/team-names";
import { Header, type ViewKey, type LiveMode } from "@/components/header";
import { LiveView } from "@/components/live-view";
import { buildMockData } from "@/lib/mock-data";
import type { Promo } from "@/components/live/rb-store-strip";
import { FixturesView } from "@/components/fixtures-view";
import { GroupsView } from "@/components/groups-view";
import { ResultsView } from "@/components/results-view";
import { BracketView } from "@/components/bracket-view";
import { RankingView } from "@/components/ranking-view";

const REFRESH_MS = 30_000;
// Scoreboard refresh, driven by a Web Worker so it stays full-rate even when the
// tab is hidden (main-thread timers get throttled to ~1/min after 5 min hidden).
const SCORE_WORKER_MS = 20_000;
// The selected match's palpites poll faster so new ones appear near-live.
const ENTRIES_REFRESH_MS = 12_000;
const DEFAULT_LETTERS = "ABCDEFGHIJKL".split("");

export default function Home() {
  const [view, setView] = useState<ViewKey>("live");
  const [dark, setDark] = useState(true);
  const [follow, setFollow] = useState<string | null>(null);
  // PLACAR (single live match) vs 2 JOGOS (two live matches) — the masthead toggle.
  const [liveMode, setLiveMode] = useState<LiveMode>("placar");

  const [matches, setMatches] = useState<Match[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panel, setPanel] = useState<"predict" | "lineup">("predict");
  const [lineups, setLineups] = useState<MatchLineups | null>(null);
  const [entries, setEntries] = useState<VoteEntry[]>([]);
  const [allEntries, setAllEntries] = useState<VoteEntry[]>([]);

  // Dev-only visualization mode (`?mock=1`): seed rich fixtures and stop all live
  // fetches from overwriting them. mockRef lets the fetch callbacks short-circuit
  // without re-subscribing. Never active in normal use.
  const [mock, setMock] = useState(false);
  const [promos, setPromos] = useState<Promo[] | null>(null);
  const mockRef = useRef(false);

  // Detect ?mock=1 (client-only, post-mount to avoid a hydration mismatch), seed
  // the fixtures and freeze live fetching. Declared first so mockRef is set before
  // the other data effects run and short-circuit. Dev visualization only.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!new URLSearchParams(window.location.search).has("mock")) return;
    mockRef.current = true;
    setMock(true);
    const d = buildMockData(Date.now());
    setMatches(d.matches);
    setGroups(d.groups);
    setVoteCounts(d.voteCounts);
    setAllEntries(d.entries);
    setPromos(d.promos);
    setLoading(false);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // ---- theme + follow persistence -----------------------------------------
  // Read persisted prefs on mount. Lazy useState init can't be used: localStorage
  // is undefined during static prerender, so this must run client-side post-mount.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      setDark(localStorage.getItem("baltfut_theme") !== "light");
      setFollow(localStorage.getItem("baltfut_follow"));
    } catch {
      /* ignore */
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    try {
      localStorage.setItem("baltfut_theme", dark ? "dark" : "light");
    } catch {
      /* ignore */
    }
  }, [dark]);
  useEffect(() => {
    try {
      if (follow) localStorage.setItem("baltfut_follow", follow);
      else localStorage.removeItem("baltfut_follow");
    } catch {
      /* ignore */
    }
  }, [follow]);

  // ---- seamless reload: restore the tab, selected match, and last data --------
  // Modo Streamer reloads the page periodically; hydrating from a sessionStorage
  // snapshot means it comes back on the same tab/match with content already shown
  // (no "Carregando…" flash, no jump to AO VIVO) before the fresh fetch lands.
  const VIEW_KEYS: ViewKey[] = ["live", "matches", "groups", "results", "bracket", "ranking"];
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (mockRef.current) return;
    try {
      const v = sessionStorage.getItem("baltfut_view");
      if (v && (VIEW_KEYS as string[]).includes(v)) setView(v as ViewKey);
      const sel = sessionStorage.getItem("baltfut_selected");
      if (sel) setSelectedId(sel);
      const raw = sessionStorage.getItem("baltfut_cache");
      if (raw) {
        const c = JSON.parse(raw);
        if (Array.isArray(c.matches) && c.matches.length) {
          setMatches(c.matches);
          setGroups(Array.isArray(c.groups) ? c.groups : []);
          setVoteCounts(c.voteCounts ?? {});
          setEntries(Array.isArray(c.entries) ? c.entries : []);
          setAllEntries(Array.isArray(c.allEntries) ? c.allEntries : []);
          setLoading(false); // show cached content instantly; fresh data updates in place
        }
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    try {
      sessionStorage.setItem("baltfut_view", view);
    } catch {
      /* ignore */
    }
    // The live view keeps its dark pitch-green backdrop regardless of theme.
    document.documentElement.setAttribute("data-view", view);
  }, [view]);
  useEffect(() => {
    try {
      if (selectedId) sessionStorage.setItem("baltfut_selected", selectedId);
      else sessionStorage.removeItem("baltfut_selected");
    } catch {
      /* ignore */
    }
  }, [selectedId]);

  // ---- data: scoreboard + standings + vote counts -------------------------
  const loadCounts = useCallback(async () => {
    if (mockRef.current) return;
    const client = getSupabaseClient();
    if (!client) return;
    try {
      setVoteCounts(await fetchVoteCounts(client));
    } catch {
      /* non-fatal */
    }
  }, []);

  const loadAll = useCallback(
    async (signal?: AbortSignal) => {
      if (mockRef.current) return;
      const [sb, st] = await Promise.allSettled([
        fetchScoreboard({ dates: FIFA_WORLD_DATE_RANGE, signal }),
        fetchStandings({ signal }),
      ]);
      if (sb.status === "fulfilled") {
        setMatches(sb.value);
        setError(null);
      } else if ((sb.reason as Error)?.name !== "AbortError") {
        setError("Não foi possível carregar os jogos. Tentando de novo…");
      }
      if (st.status === "fulfilled") setGroups(st.value);
      await loadCounts();
      setLoading(false);
    },
    [loadCounts],
  );

  // Standings + vote counts refresh. The scoreboard is owned by the worker below,
  // so the periodic timer only needs these (which change rarely).
  const loadAux = useCallback(async () => {
    if (mockRef.current) return;
    try {
      setGroups(await fetchStandings());
    } catch {
      /* non-fatal */
    }
    await loadCounts();
  }, [loadCounts]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const controller = new AbortController();
    void loadAll(controller.signal); // initial: scoreboard + standings + counts
    const id = setInterval(() => void loadAux(), REFRESH_MS); // periodic: aux only
    return () => {
      controller.abort();
      clearInterval(id);
    };
  }, [loadAll, loadAux]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Scoreboard via a Web Worker: worker timers escape the hidden-tab throttle, so
  // the score stays full-rate even while the streamer's window is hidden (the
  // Modo Streamer PiP keeps it painting; this keeps the data current).
  useEffect(() => {
    return startScoreboardWorker(
      scoreboardUrl(DEFAULT_LEAGUE, FIFA_WORLD_DATE_RANGE),
      SCORE_WORKER_MS,
      (json) => {
        if (mockRef.current) return;
        const next = parseScoreboard(json, DEFAULT_LEAGUE);
        if (next.length) {
          setMatches(next);
          setError(null);
        }
      },
    );
  }, []);

  // Snapshot the latest data so the next (Modo Streamer) reload can paint it
  // instantly instead of the empty loading state.
  useEffect(() => {
    if (loading) return;
    try {
      sessionStorage.setItem(
        "baltfut_cache",
        JSON.stringify({ matches, groups, voteCounts, entries, allEntries }),
      );
    } catch {
      /* quota / serialization — non-fatal */
    }
  }, [loading, matches, groups, voteCounts, entries, allEntries]);

  // ---- derived ------------------------------------------------------------
  const upcoming = useMemo(
    () =>
      matches
        .filter((m) => m.state === "pre")
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    [matches],
  );
  const results = useMemo(
    () =>
      matches
        .filter((m) => m.state === "post")
        .sort((a, b) => b.startsAt.localeCompare(a.startsAt)),
    [matches],
  );
  const groupByTeam = useMemo(() => teamGroupMap(groups), [groups]);
  const bracketColumns = useMemo(
    () => buildBracket(groups.length ? groups.map((g) => g.letter) : DEFAULT_LETTERS),
    [groups],
  );
  const chips = useMemo(() => buildChipGames(matches, voteCounts), [matches, voteCounts]);
  const releasedIds = useMemo(() => releasedMatchIds(matches), [matches]);

  // Keep the selection valid as chips change; default to a live game.
  const activeId =
    selectedId && chips.some((c) => c.match.id === selectedId)
      ? selectedId
      : defaultChipId(chips);
  const activeMatch = chips.find((c) => c.match.id === activeId)?.match ?? null;
  // In mock mode the per-match palpite feed comes from the seeded set, not the
  // (disabled) Supabase poll.
  const liveEntries = mock ? allEntries.filter((e) => e.matchId === activeId) : entries;
  const prevActive = useRef<{ id?: string; state?: string }>({});

  // ---- votes + lineups for the selected chip ------------------------------
  const loadEntries = useCallback(async (matchId: string) => {
    if (mockRef.current) return;
    const client = getSupabaseClient();
    if (!client) {
      setEntries([]);
      return;
    }
    try {
      setEntries(await fetchVoteEntries(client, matchId));
    } catch {
      setEntries([]);
    }
  }, []);

  const loadAllEntries = useCallback(async () => {
    if (mockRef.current) return;
    const client = getSupabaseClient();
    if (!client) {
      setAllEntries([]);
      return;
    }
    try {
      setAllEntries(await fetchAllEntries(client));
    } catch {
      setAllEntries([]);
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (view !== "live" || !activeId) return;
    void loadEntries(activeId);
    // Poll so palpites others submit appear without a manual refresh.
    const id = setInterval(() => void loadEntries(activeId), ENTRIES_REFRESH_MS);
    return () => clearInterval(id);
  }, [view, activeId, loadEntries]);

  // Realtime push: the cast-vote function broadcasts a dataless "new" nudge for a
  // match when a palpite lands; we refetch the (secure, public) feed immediately
  // instead of waiting for the poll. The broadcast carries no row data, so it
  // can't leak ip_hash; the poll above stays as a fallback if Realtime is down.
  useEffect(() => {
    if (view !== "live" || !activeId) return;
    const client = getSupabaseClient();
    if (!client) return;
    const channel = client
      .channel(`palpites:${activeId}`)
      .on("broadcast", { event: "new" }, () => {
        void loadEntries(activeId);
        void loadAllEntries();
      })
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [view, activeId, loadEntries, loadAllEntries]);

  useEffect(() => {
    if (view !== "live" || !activeId) return;
    const controller = new AbortController();
    setLineups(null);
    fetchLineups(activeId, { signal: controller.signal })
      .then((l) => setLineups(l))
      .catch(() => setLineups(null));
    return () => controller.abort();
  }, [view, activeId]);

  useEffect(() => {
    // The live tab shows a ranking sidebar too, so keep allEntries fresh there.
    if (view !== "ranking" && view !== "live") return;
    void loadAllEntries();
    const id = setInterval(() => void loadAllEntries(), REFRESH_MS);
    return () => clearInterval(id);
  }, [view, loadAllEntries]);

  // When the match being watched flips live -> finished, auto-advance to the
  // next frontier match (clear the manual selection). Only the same match's
  // own transition triggers it, so viewing a finished match stays put.
  useEffect(() => {
    if (
      prevActive.current.id === activeMatch?.id &&
      prevActive.current.state === "in" &&
      activeMatch?.state === "post"
    ) {
      setSelectedId(null);
    }
    prevActive.current = { id: activeMatch?.id, state: activeMatch?.state };
  }, [activeMatch?.id, activeMatch?.state]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Catch up the moment the tab becomes visible again: refetch instead of waiting
  // for the next (possibly throttled) poll, so a backgrounded tab isn't stale.
  useEffect(() => {
    const onVisible = () => {
      if (document.hidden) return;
      void loadAll();
      if (activeId) void loadEntries(activeId);
      if (view === "live" || view === "ranking") void loadAllEntries();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [loadAll, loadEntries, loadAllEntries, activeId, view]);

  const followName = follow ? teamNamePt(follow, follow) : null;
  const toggleFollow = (code: string) => setFollow((f) => (f === code ? null : code));

  const onVoted = () => {
    if (activeId) void loadEntries(activeId);
    void loadCounts();
  };

  // Masthead PLACAR / 2 JOGOS toggle: set the mode and jump to the live view. For
  // 2 JOGOS, if the current selection isn't a live match, fall back to the default
  // (live) chip so the dual-match stage actually has live games to show.
  const onLiveMode = (m: LiveMode) => {
    setLiveMode(m);
    setView("live");
    if (m === "duo") {
      const sel = chips.find((c) => c.match.id === activeId);
      if (!sel || sel.phase !== "live") setSelectedId(null);
    }
  };

  return (
    <>
      <Header
        view={view}
        onView={setView}
        dark={dark}
        onToggleTheme={() => setDark((d) => !d)}
        followCode={follow}
        followName={followName}
        onClearFollow={() => setFollow(null)}
        liveMode={liveMode}
        onLiveMode={onLiveMode}
      />
      <main
        style={
          view === "live"
            ? { maxWidth: 1620, margin: "0 auto", padding: "8px 24px 10px" }
            : { maxWidth: 1180, margin: "0 auto", padding: "10px 23px 60px" }
        }
      >
        {loading ? (
          <p style={{ color: "var(--ink-3)" }}>Carregando…</p>
        ) : error && matches.length === 0 ? (
          <p style={{ color: "#e5484d" }}>{error}</p>
        ) : null}

        {!loading && view === "live" && (
          <LiveView
            chips={chips}
            selectedId={activeId}
            onSelect={setSelectedId}
            panel={panel}
            onPanel={setPanel}
            lineups={lineups}
            entries={liveEntries}
            allEntries={allEntries}
            matches={matches}
            onVoted={onVoted}
            followCode={follow}
            groupByTeam={groupByTeam}
            releasedIds={releasedIds}
            liveMode={liveMode}
            promos={promos}
          />
        )}
        {!loading && view === "matches" && (
          <FixturesView matches={upcoming} followCode={follow} groupByTeam={groupByTeam} />
        )}
        {!loading && view === "groups" && (
          <GroupsView groups={groups} followCode={follow} onFollow={toggleFollow} />
        )}
        {!loading && view === "results" && (
          <ResultsView matches={results} followCode={follow} groupByTeam={groupByTeam} />
        )}
        {!loading && view === "bracket" && <BracketView columns={bracketColumns} />}
        {!loading && view === "ranking" && (
          <RankingView entries={allEntries} matches={matches} />
        )}
      </main>
    </>
  );
}
