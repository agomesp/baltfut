"use client";

import { useState, type FormEvent } from "react";
import type { Match } from "@/lib/espn";
import {
  submitVote,
  supabaseCastVote,
  rankPredictions,
  type CastVoteTransport,
  type SubmitOutcome,
  type VoteEntry,
  type PredictionStatus,
} from "@/lib/votes";
import { MONO } from "@/components/primitives";

const STATUS_LABEL: Record<PredictionStatus, string> = {
  winning: "Ganhando",
  can: "Pode ganhar",
  losing: "Perdendo",
};

export interface PredictionPanelProps {
  match: Match;
  entries: VoteEntry[];
  current: { home: number; away: number };
  onVoted: () => void;
  /** Injectable for tests; defaults to the live Edge Function call. */
  transport?: CastVoteTransport;
}

const inputStyle = {
  fontFamily: "var(--font-body)",
  fontSize: 14,
  color: "var(--ink)",
  background: "var(--bg)",
  border: "1px solid var(--line-2)",
  borderRadius: 4,
  padding: "9px 11px",
  outline: "none",
  width: "100%",
} as const;

export function PredictionPanel({
  match,
  entries,
  current,
  onVoted,
  transport = supabaseCastVote,
}: PredictionPanelProps) {
  const [user, setUser] = useState("");
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<SubmitOutcome | null>(null);

  const ranked = rankPredictions(entries, current);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setOutcome(null);
    const input = {
      matchId: match.id,
      league: match.league,
      username: user,
      predHome: Number.parseInt(home, 10) || 0,
      predAway: Number.parseInt(away, 10) || 0,
    };
    const result = await submitVote(input, transport);
    setOutcome(result);
    setSubmitting(false);
    if (result.ok) {
      setHome("");
      setAway("");
      onVoted();
    }
  }

  const digits = (v: string) => v.replace(/[^0-9]/g, "").slice(0, 2);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: "1 1 auto", minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "14px 18px 0" }}>
        <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--ink-2)" }}>
          Palpite o placar
        </span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--ink-3)" }}>
          {ranked.length ? `${ranked.length} palpites` : ""}
        </span>
      </div>

      <form onSubmit={handleSubmit} style={{ padding: "14px 18px 16px", display: "flex", flexDirection: "column", gap: 12, borderBottom: "1px solid var(--line)" }}>
        <input
          value={user}
          onChange={(e) => setUser(e.target.value)}
          placeholder="Seu nome"
          maxLength={24}
          autoComplete="off"
          aria-label="Seu nome"
          style={inputStyle}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ flex: "0 0 auto", fontFamily: MONO, fontWeight: 500, fontSize: 15, color: "var(--ink)" }}>{match.home.abbreviation}</span>
          <input value={home} onChange={(e) => setHome(digits(e.target.value))} inputMode="numeric" placeholder="0" aria-label={`Gols ${match.home.abbreviation}`} style={{ ...inputStyle, flex: "1 1 0", minWidth: 0, textAlign: "center", fontFamily: MONO, fontSize: 16, padding: "9px 4px" }} />
          <span style={{ flex: "0 0 auto", fontFamily: MONO, fontSize: 13, color: "var(--ink-3)" }}>x</span>
          <input value={away} onChange={(e) => setAway(digits(e.target.value))} inputMode="numeric" placeholder="0" aria-label={`Gols ${match.away.abbreviation}`} style={{ ...inputStyle, flex: "1 1 0", minWidth: 0, textAlign: "center", fontFamily: MONO, fontSize: 16, padding: "9px 4px" }} />
          <span style={{ flex: "0 0 auto", fontFamily: MONO, fontWeight: 500, fontSize: 15, color: "var(--ink)" }}>{match.away.abbreviation}</span>
        </div>
        <button
          type="submit"
          disabled={submitting}
          style={{ fontFamily: MONO, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--signal-ink)", background: "var(--signal)", border: "none", borderRadius: 4, padding: "10px 12px", cursor: "pointer", opacity: submitting ? 0.7 : 1 }}
        >
          {submitting ? "Enviando…" : "Enviar palpite"}
        </button>
        {outcome && !outcome.ok ? (
          <span role="alert" style={{ fontSize: 12, color: "#e5484d" }}>{outcome.message}</span>
        ) : null}
        {outcome?.ok ? (
          <span style={{ fontSize: 12, color: "var(--signal-strong)" }}>Palpite enviado!</span>
        ) : null}
      </form>

      <div style={{ flex: "1 1 auto", padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", maxHeight: 420 }}>
        {ranked.length === 0 ? (
          <span style={{ fontSize: 13, color: "var(--ink-3)" }}>Nenhum palpite ainda. Seja o primeiro.</span>
        ) : (
          ranked.map((v, i) => {
            const win = v.status === "winning";
            const lose = v.status === "losing";
            const numColor = lose ? "var(--ink-3)" : "var(--signal-strong)";
            return (
              <div key={`${v.username}-${i}`} style={{ display: "flex", flexDirection: "column", gap: 4, padding: "7px 8px 9px", borderRadius: 4, borderBottom: "1px solid var(--line)", background: win ? "var(--signal-tint)" : "transparent" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: 13, color: lose ? "var(--ink-3)" : "var(--ink)" }}>{v.username}</span>
                  <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: win ? "var(--signal-strong)" : "var(--ink-3)" }}>
                    {STATUS_LABEL[v.status]}
                  </span>
                </div>
                <span style={{ fontFamily: MONO, fontSize: 13, color: lose ? "var(--ink-3)" : "var(--ink-2)" }}>
                  {match.home.abbreviation} [<span style={{ color: numColor }}>{v.predHome}</span>] x [<span style={{ color: numColor }}>{v.predAway}</span>] {match.away.abbreviation}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
