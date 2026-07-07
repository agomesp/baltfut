"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchScoreboard,
  fetchStandings,
  fetchLineups,
  teamGroupMap,
  buildKnockout,
  parseStandings,
  standingsUrl,
  DEFAULT_LEAGUE,
  FIFA_WORLD_DATE_RANGE,
  type Match,
  type Group,
  type MatchLineups,
} from "@/lib/espn";
import { startScoreboardWorker } from "@/lib/scoreboard-worker";
import { subscribeScoreboard } from "@/lib/scoreboard-source";
import { subscribeHeartbeat } from "@/lib/heartbeat";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  fetchVoteEntries,
  fetchAllEntries,
  fetchVoteCounts,
  type VoteEntry,
} from "@/lib/votes";
import { fetchMatchResults } from "@/lib/match-results";
import { fetchBracketEntries, type BracketEntry } from "@/lib/bracket-votes";
import type { MatchResult } from "@/lib/ranking";
import { buildChipGames, defaultChipId } from "@/lib/chips";
import { releasedMatchIds } from "@/lib/palpite";
import { teamNamePt } from "@/lib/team-names";
import { Header, type ViewKey } from "@/components/header";
import { LiveView } from "@/components/live-view";
import { BracketPalpiteView } from "@/components/bracket-palpite-view";
import { FixturesView } from "@/components/fixtures-view";
import { GroupsView } from "@/components/groups-view";
import { ResultsView } from "@/components/results-view";
import { BracketView } from "@/components/bracket-view";
import { AiPalpitesView } from "@/components/ai-palpites-view";
import { BottomTabBar } from "@/components/bottom-tab-bar";
import { LiveSubDock } from "@/components/live-sub-dock";

const REFRESH_MS = 30_000;
// Standings drive the bracket (chaveamento) seeds — also worker-polled so they
// stay current while the tab is hidden. Gentler than the score: table positions
// change far less often than the live clock.
const STANDINGS_WORKER_MS = 30_000;
// The selected match's palpites poll faster so new ones appear near-live.
const ENTRIES_REFRESH_MS = 12_000;

// DEV-ONLY test aid: with `?mocklive` in the URL (and only under `next dev`), flip
// the earliest upcoming match to a live 1st half so the live-match UI — including
// the streamer promo mode, which is live-only — can be exercised without waiting
// for a real kickoff. Guarded by NODE_ENV so it's a no-op in the production build.
function withMockLive(matches: Match[]): Match[] {
  if (process.env.NODE_ENV === "production") return matches;
  if (typeof window === "undefined" || !new URLSearchParams(window.location.search).has("mocklive")) return matches;
  const i = matches.findIndex((m) => m.state === "pre");
  if (i < 0) return matches;
  const kickoff = new Date(Date.now() - 2 * 60_000).toISOString(); // 2' ago → live + palpites still open
  const mock: Match = { ...matches[i], state: "in", isLive: true, statusDetail: "1º tempo", displayClock: "2'", startsAt: kickoff, homeScore: 0, awayScore: 0 };
  return matches.map((x, k) => (k === i ? mock : x));
}

export default function Home() {
  const [view, setView] = useState<ViewKey>("live");
  const [dark, setDark] = useState(true);
  const [follow, setFollow] = useState<string | null>(null);

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
  // Durable finished-match scores (match_results) — the ranking grades on these
  // first so ESPN can't cost anyone their wins by dropping/changing an old result.
  const [matchResults, setMatchResults] = useState<Record<string, MatchResult>>({});
  // Saved knockout brackets — 0.2 per correct winner folds into the Ranking dos Subs.
  const [brackets, setBrackets] = useState<BracketEntry[]>([]);
  // Top switcher inside the live tab: the live "Partidas" view vs the bracket palpite.
  const [liveSubTab, setLiveSubTab] = useState<"partidas" | "chaveamento">("partidas");
  // Admin manual pen-vote control, per match, pushed in realtime (null = auto).
  const [penOverrides, setPenOverrides] = useState<Record<string, "open" | "closed">>({});
  // Admin manual palpite WINDOW, per match: match_id → openUntil (epoch ms). Read
  // from palpite_overrides on load and updated live via realtime broadcast. Lets
  // the admin extend/reopen/close-early a match's score-palpite window for everyone.
  const [palpiteOverrides, setPalpiteOverrides] = useState<Record<string, number>>({});

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
  const VIEW_KEYS: ViewKey[] = ["live", "matches", "groups", "results", "bracket", "ai"];
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const v = sessionStorage.getItem("baltfut_view");
      if (v && (VIEW_KEYS as string[]).includes(v)) setView(v as ViewKey);
      const sel = sessionStorage.getItem("baltfut_selected");
      if (sel) setSelectedId(sel);
      const raw = sessionStorage.getItem("baltfut_cache");
      if (raw) {
        const c = JSON.parse(raw);
        if (Array.isArray(c.matches) && c.matches.length) {
          setMatches(withMockLive(c.matches));
          setGroups(Array.isArray(c.groups) ? c.groups : []);
          setVoteCounts(c.voteCounts ?? {});
          setEntries(Array.isArray(c.entries) ? c.entries : []);
          setAllEntries(Array.isArray(c.allEntries) ? c.allEntries : []);
          setMatchResults(c.matchResults && typeof c.matchResults === "object" ? c.matchResults : {});
          setBrackets(Array.isArray(c.brackets) ? c.brackets : []);
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
    const client = getSupabaseClient();
    if (!client) return;
    try {
      setVoteCounts(await fetchVoteCounts(client));
    } catch {
      /* non-fatal */
    }
  }, []);

  // Manual palpite windows (admin). Public, non-PII read (match_id + open_until).
  const loadPalpiteOverrides = useCallback(async () => {
    const client = getSupabaseClient();
    if (!client) return;
    try {
      const { data } = await client.from("palpite_overrides").select("match_id, open_until");
      const next: Record<string, number> = {};
      for (const row of data ?? []) {
        const t = Date.parse((row as { open_until: string }).open_until);
        if (!Number.isNaN(t)) next[(row as { match_id: string }).match_id] = t;
      }
      setPalpiteOverrides(next);
    } catch {
      /* non-fatal — default cutoff applies */
    }
  }, []);

  const loadAll = useCallback(
    async (signal?: AbortSignal) => {
      const [sb, st] = await Promise.allSettled([
        fetchScoreboard({ dates: FIFA_WORLD_DATE_RANGE, signal }),
        fetchStandings({ signal }),
      ]);
      if (sb.status === "fulfilled") {
        setMatches(withMockLive(sb.value));
        setError(null);
      } else if ((sb.reason as Error)?.name !== "AbortError") {
        setError("Não foi possível carregar os jogos. Tentando de novo…");
      }
      if (st.status === "fulfilled") setGroups(st.value);
      await loadCounts();
      void loadPalpiteOverrides();
      setLoading(false);
    },
    [loadCounts, loadPalpiteOverrides],
  );

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const controller = new AbortController();
    void loadAll(controller.signal); // initial: scoreboard + standings + counts
    return () => controller.abort();
  }, [loadAll]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Vote counts refresh. Heartbeat-driven (the shared worker tick), not a
  // main-thread timer, so the counts stay fresh while the tab is hidden — matching
  // the scoreboard + standings workers. (The Supabase fetch needs the client's
  // auth headers, so it can't ride the bare URL-poll worker; the heartbeat is the
  // hidden-safe trigger and the main-thread fetch itself isn't timer-throttled.)
  useEffect(() => {
    let last = Date.now();
    return subscribeHeartbeat(() => {
      if (Date.now() - last < REFRESH_MS) return;
      last = Date.now();
      void loadCounts();
    });
  }, [loadCounts]);

  // Scoreboard via the SHARED, ref-counted worker source — one poller for the
  // page, Modo Streamer and PiP (audit A2). Worker-backed, so the score stays
  // full-rate even while the streamer's window is hidden; the source already
  // parses + drops empty payloads, so we just apply the Match[].
  //
  // INVARIANT: this must stay subscribed for the app's whole lifetime (empty
  // deps, no condition). The page is the source's permanent first subscriber —
  // it's what keeps the worker alive, which is what keeps the score fresh while
  // the tab is hidden (e.g. a streamer who just switches windows, with Modo
  // Streamer OFF). Don't add deps or gate this, or it'll churn/stop the worker.
  useEffect(() => {
    return subscribeScoreboard((next) => {
      setMatches(withMockLive(next));
      setError(null);
    });
  }, []);

  // Standings via the same worker primitive, so the bracket (chaveamento) seeds
  // stay current while the tab is hidden. Without this the throttled main-thread
  // timer froze the table and the bracket showed stale qualifiers on a backgrounded
  // (e.g. streamer) tab — the scoreboard stayed live while the bracket did not.
  useEffect(() => {
    return startScoreboardWorker(
      standingsUrl(DEFAULT_LEAGUE),
      STANDINGS_WORKER_MS,
      (json) => {
        const next = parseStandings(json);
        if (next.length) setGroups(next);
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
        JSON.stringify({ matches, groups, voteCounts, entries, allEntries, matchResults, brackets }),
      );
    } catch {
      /* quota / serialization — non-fatal */
    }
  }, [loading, matches, groups, voteCounts, entries, allEntries, matchResults, brackets]);

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
  const knockout = useMemo(() => buildKnockout(matches), [matches]);
  const chips = useMemo(() => buildChipGames(matches, voteCounts), [matches, voteCounts]);
  const releasedIds = useMemo(() => releasedMatchIds(matches), [matches]);

  // Keep the selection valid as chips change; default to a live game.
  const activeId =
    selectedId && chips.some((c) => c.match.id === selectedId)
      ? selectedId
      : defaultChipId(chips);
  const activeMatch = chips.find((c) => c.match.id === activeId)?.match ?? null;
  const prevActive = useRef<{ id?: string; state?: string }>({});

  // ---- votes + lineups for the selected chip ------------------------------
  const loadEntries = useCallback(async (matchId: string) => {
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
    const client = getSupabaseClient();
    if (!client) {
      setAllEntries([]);
      setMatchResults({});
      setBrackets([]);
      return;
    }
    try {
      // Palpites + durable results + brackets together — all feed the ranking.
      // fetchMatchResults/fetchBracketEntries are self-resilient ({}/[] on error).
      const [entries, results, brs] = await Promise.all([
        fetchAllEntries(client),
        fetchMatchResults(client),
        fetchBracketEntries(client),
      ]);
      setAllEntries(entries);
      setMatchResults(results);
      setBrackets(brs);
    } catch {
      setAllEntries([]);
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (view !== "live" || !activeId) return;
    void loadEntries(activeId);
    // Poll so palpites others submit appear without a manual refresh — driven by
    // the worker heartbeat so it survives a hidden/backgrounded tab.
    let last = Date.now();
    return subscribeHeartbeat(() => {
      if (Date.now() - last < ENTRIES_REFRESH_MS) return;
      last = Date.now();
      void loadEntries(activeId);
    });
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

  // Realtime push: the admin (baltfut-admin) broadcasts a manual pen-vote control
  // for a match — liberate/close — and re-broadcasts it so late joiners catch up.
  // The streamer + every viewer flip the pen picker on/off with no reload.
  useEffect(() => {
    if (view !== "live" || !activeId) return;
    const client = getSupabaseClient();
    if (!client) return;
    const channel = client
      .channel(`pen:${activeId}`)
      .on("broadcast", { event: "set" }, (msg) => {
        const state = (msg.payload as { state?: unknown })?.state;
        setPenOverrides((cur) => {
          if (state === "open" || state === "closed") return { ...cur, [activeId]: state };
          if (!(activeId in cur)) return cur;
          const next = { ...cur };
          delete next[activeId]; // anything else → back to automatic
          return next;
        });
      })
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [view, activeId]);

  // Realtime push: the admin broadcasts a manual palpite-window change for a match
  // (extend / reopen / close-early / back-to-auto). Mirrors the pen control: every
  // viewer's form re-opens or closes with no reload, and cast-vote honors the same
  // window server-side so the submit actually lands.
  useEffect(() => {
    if (view !== "live" || !activeId) return;
    const client = getSupabaseClient();
    if (!client) return;
    const channel = client
      .channel(`palpite-window:${activeId}`)
      .on("broadcast", { event: "set" }, (msg) => {
        const raw = (msg.payload as { openUntil?: unknown })?.openUntil;
        const t = typeof raw === "string" ? Date.parse(raw) : NaN;
        setPalpiteOverrides((cur) => {
          if (!Number.isNaN(t)) return { ...cur, [activeId]: t };
          if (!(activeId in cur)) return cur;
          const next = { ...cur };
          delete next[activeId]; // null/cleared → back to the automatic cutoff
          return next;
        });
      })
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [view, activeId]);

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
    // The live tab shows the ranking sidebar, so keep allEntries fresh there.
    if (view !== "live") return;
    void loadAllEntries();
    // Heartbeat-driven so the ranking stays fresh while the tab is hidden.
    let last = Date.now();
    return subscribeHeartbeat(() => {
      if (Date.now() - last < REFRESH_MS) return;
      last = Date.now();
      void loadAllEntries();
    });
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
      if (view === "live") void loadAllEntries();
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

  return (
    <>
      {/* The live screen mounts its own compact masthead (brand + notice) inline
          next to the match rail, so the global header is suppressed there to
          reclaim vertical height. Every other tab keeps the full header. */}
      {view !== "live" && (
        <Header
          followCode={follow}
          followName={followName}
          onClearFollow={() => setFollow(null)}
        />
      )}
      {/* Shell padding (incl. the live-view variant + mobile sizes) lives in
          globals.css `.bf-main`, keyed off the html `data-view` attribute. */}
      <main className="bf-main">
        {loading ? (
          <p style={{ color: "var(--ink-3)" }}>Carregando…</p>
        ) : error && matches.length === 0 ? (
          <p style={{ color: "#e5484d" }}>{error}</p>
        ) : null}

        {!loading && view === "live" && (
          <>
            {liveSubTab === "partidas" ? (
              <LiveView
                chips={chips}
                selectedId={activeId}
                onSelect={setSelectedId}
                panel={panel}
                onPanel={setPanel}
                lineups={lineups}
                entries={entries}
                allEntries={allEntries}
                matches={matches}
                matchResults={matchResults}
                brackets={brackets}
                onVoted={onVoted}
                followCode={follow}
                groupByTeam={groupByTeam}
                releasedIds={releasedIds}
                penOverride={(activeId && penOverrides[activeId]) || null}
                palpiteOverrides={palpiteOverrides}
              />
            ) : (
              <BracketPalpiteView matches={matches} brackets={brackets} onSaved={loadAllEntries} />
            )}
          </>
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
        {!loading && view === "bracket" && <BracketView stages={knockout} />}
        {!loading && view === "ai" && (
          <AiPalpitesView matches={matches} groups={groups} groupByTeam={groupByTeam} palpiteOverrides={palpiteOverrides} />
        )}
      </main>
      {/* Primary navigation: the bottom dock (2.1 sport). On the live tab a yellow
          second dock sits to its right to switch Partidas ↔ Chaveamento. The row is
          bottom-centered; it wraps (second dock above) if it can't fit one line. */}
      <div style={{ position: "fixed", left: "50%", bottom: 14, transform: "translateX(-50%)", zIndex: 65, display: "flex", alignItems: "flex-end", justifyContent: "center", flexWrap: "wrap-reverse", gap: 10, maxWidth: "calc(100vw - 16px)" }}>
        <BottomTabBar view={view} onView={setView} variant="v3" inline />
        {view === "live" ? <LiveSubDock value={liveSubTab} onChange={setLiveSubTab} /> : null}
      </div>
    </>
  );
}
