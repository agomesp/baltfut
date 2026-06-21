"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchScoreboard,
  fetchStandings,
  fetchLineups,
  teamGroupMap,
  buildBracket,
  FIFA_WORLD_DATE_RANGE,
  type Match,
  type Group,
  type MatchLineups,
} from "@/lib/espn";
import { getSupabaseClient } from "@/lib/supabase/client";
import { fetchVoteEntries, fetchVoteCounts, type VoteEntry } from "@/lib/votes";
import { buildChipGames, defaultChipId } from "@/lib/chips";
import { teamNamePt } from "@/lib/team-names";
import { Header, type ViewKey } from "@/components/header";
import { LiveView } from "@/components/live-view";
import { FixturesView } from "@/components/fixtures-view";
import { GroupsView } from "@/components/groups-view";
import { ResultsView } from "@/components/results-view";
import { BracketView } from "@/components/bracket-view";

const REFRESH_MS = 30_000;
const DEFAULT_LETTERS = "ABCDEFGHIJKL".split("");

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

  const loadAll = useCallback(
    async (signal?: AbortSignal) => {
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

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const controller = new AbortController();
    void loadAll(controller.signal);
    const id = setInterval(() => void loadAll(), REFRESH_MS);
    return () => {
      controller.abort();
      clearInterval(id);
    };
  }, [loadAll]);
  /* eslint-enable react-hooks/set-state-in-effect */

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

  // Keep the selection valid as chips change; default to a live game.
  const activeId =
    selectedId && chips.some((c) => c.match.id === selectedId)
      ? selectedId
      : defaultChipId(chips);

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

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (view !== "live" || !activeId) return;
    void loadEntries(activeId);
  }, [view, activeId, loadEntries]);

  useEffect(() => {
    if (view !== "live" || !activeId) return;
    const controller = new AbortController();
    setLineups(null);
    fetchLineups(activeId, { signal: controller.signal })
      .then((l) => setLineups(l))
      .catch(() => setLineups(null));
    return () => controller.abort();
  }, [view, activeId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const followName = follow ? teamNamePt(follow, follow) : null;
  const toggleFollow = (code: string) => setFollow((f) => (f === code ? null : code));

  const onVoted = () => {
    if (activeId) void loadEntries(activeId);
    void loadCounts();
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
      />
      <main style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 24px 96px" }}>
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
            entries={entries}
            onVoted={onVoted}
            followCode={follow}
            groupByTeam={groupByTeam}
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
      </main>
    </>
  );
}
