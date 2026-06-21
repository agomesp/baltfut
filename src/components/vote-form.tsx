"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Match } from "@/lib/espn";
import type { PreferredSide } from "@shared/vote";
import { submitVote, type SubmitOutcome } from "@/lib/votes/submit";
import { supabaseCastVote } from "@/lib/votes/transport";
import type { CastVoteTransport } from "@/lib/votes/submit";

export interface VoteFormProps {
  match: Match;
  /** Called after a vote is successfully recorded (e.g. to refresh results). */
  onVoted?: () => void;
  /** Injectable transport; defaults to the live Edge Function call. */
  transport?: CastVoteTransport;
}

export function VoteForm({
  match,
  onVoted,
  transport = supabaseCastVote,
}: VoteFormProps) {
  const [username, setUsername] = useState("");
  const [side, setSide] = useState<PreferredSide | null>(null);
  const [predHome, setPredHome] = useState("0");
  const [predAway, setPredAway] = useState("0");
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<SubmitOutcome | null>(null);

  const uid = `vote-${match.id}`;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setOutcome(null);

    const input = {
      matchId: match.id,
      league: match.league,
      username,
      preferredSide: side,
      preferredTeamAbbr:
        side === "home"
          ? match.home.abbreviation
          : side === "away"
            ? match.away.abbreviation
            : "",
      predHome: Number(predHome),
      predAway: Number(predAway),
    };

    const result = await submitVote(input, transport);
    setOutcome(result);
    setSubmitting(false);
    if (result.ok) onVoted?.();
  }

  if (outcome?.ok) {
    return (
      <p className="rounded-md bg-green-500/10 px-3 py-2 text-sm text-green-700">
        Thanks — your vote is in!
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 border-t pt-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${uid}-name`}>Your name</Label>
        <Input
          id={`${uid}-name`}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          maxLength={24}
          placeholder="e.g. Allan"
          autoComplete="off"
        />
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-sm font-medium">Who will win?</legend>
        <div className="flex gap-2">
          {(["home", "away"] as const).map((s) => {
            const team = s === "home" ? match.home : match.away;
            return (
              <Button
                key={s}
                type="button"
                variant={side === s ? "default" : "outline"}
                aria-pressed={side === s}
                className="flex-1"
                onClick={() => setSide(s)}
              >
                {team.name}
              </Button>
            );
          })}
        </div>
      </fieldset>

      <div className="flex items-end gap-2">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor={`${uid}-ph`}>{match.home.abbreviation}</Label>
          <Input
            id={`${uid}-ph`}
            type="number"
            min={0}
            max={30}
            value={predHome}
            onChange={(e) => setPredHome(e.target.value)}
          />
        </div>
        <span className="pb-2 text-muted-foreground">–</span>
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor={`${uid}-pa`}>{match.away.abbreviation}</Label>
          <Input
            id={`${uid}-pa`}
            type="number"
            min={0}
            max={30}
            value={predAway}
            onChange={(e) => setPredAway(e.target.value)}
          />
        </div>
      </div>

      <Button type="submit" disabled={submitting}>
        {submitting ? "Submitting…" : "Submit vote"}
      </Button>

      {outcome && !outcome.ok ? (
        <p
          className={cn("text-sm text-destructive")}
          role="alert"
          aria-live="polite"
        >
          {outcome.message}
        </p>
      ) : null}
    </form>
  );
}
