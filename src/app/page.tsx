"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchScoreboard, type Match, type MatchState } from "@/lib/espn";
import { getSupabaseClient } from "@/lib/supabase/client";
import { fetchVoteResults, type VoteResult } from "@/lib/votes/results";
import { MatchCard } from "@/components/match-card";
import { VoteForm } from "@/components/vote-form";

const REFRESH_MS = 30_000;
// Live first, then upcoming, then finished.
const STATE_ORDER: Record<MatchState, number> = { in: 0, pre: 1, post: 2 };

export default function Home() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [results, setResults] = useState<Record<string, VoteResult>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadResults = useCallback(async () => {
    const client = getSupabaseClient();
    if (!client) return; // votes feature off until Supabase env is set
    try {
      const rows = await fetchVoteResults(client);
      setResults(Object.fromEntries(rows.map((r) => [r.matchId, r])));
    } catch {
      // Non-fatal: scores still render without the crowd tally.
    }
  }, []);

  const loadMatches = useCallback(async (signal?: AbortSignal) => {
    try {
      const data = await fetchScoreboard({ signal });
      data.sort(
        (a, b) =>
          STATE_ORDER[a.state] - STATE_ORDER[b.state] ||
          a.startsAt.localeCompare(b.startsAt),
      );
      setMatches(data);
      setError(null);
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError("Couldn't load live matches. Retrying…");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // This effect subscribes to external systems (ESPN scoreboard + the vote
  // views) and only setState inside async continuations once that external
  // data arrives or the poll fires — the pattern the rule's docs allow. The
  // linter can't see past the awaits, so we scope the disable to this effect.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const controller = new AbortController();
    void loadMatches(controller.signal);
    void loadResults();
    const id = setInterval(() => {
      void loadMatches();
      void loadResults();
    }, REFRESH_MS);
    return () => {
      controller.abort();
      clearInterval(id);
    };
  }, [loadMatches, loadResults]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">baltfut</h1>
        <p className="text-sm text-muted-foreground">
          Live soccer scores &amp; crowd predictions.
        </p>
      </header>

      {loading ? (
        <p className="text-muted-foreground">Loading live matches…</p>
      ) : null}
      {error ? <p className="text-destructive">{error}</p> : null}
      {!loading && !error && matches.length === 0 ? (
        <p className="text-muted-foreground">No matches scheduled right now.</p>
      ) : null}

      <div className="flex flex-col gap-4">
        {matches.map((match) => (
          <MatchCard
            key={match.id}
            match={match}
            result={results[match.id] ?? null}
          >
            {match.state !== "post" ? (
              <VoteForm match={match} onVoted={loadResults} />
            ) : null}
          </MatchCard>
        ))}
      </div>
    </main>
  );
}
