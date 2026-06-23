"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { Match } from "@/lib/espn";
import { useNow } from "@/lib/use-now";
import {
  submitVote,
  supabaseCastVote,
  rankPredictions,
  type CastVoteTransport,
  type SubmitOutcome,
  type VoteEntry,
  type PredictionStatus,
} from "@/lib/votes";
import type { ChipPhase } from "@/lib/chips";
import { isPalpiteOpen, formatCountdown } from "@/lib/palpite";
import { isReservedName } from "@shared/name-claim";
import { MONO } from "@/components/primitives";

// The house bot's palpites render with a rainbow-gradient name so they read as
// "official", not a regular user. background-clip: text paints the gradient
// through the glyphs; the literal color is a fallback for browsers without it.
const rainbowNameStyle = {
  background: "linear-gradient(90deg, #ff3b30, #ff9500, #ffcc00, #34c759, #00c7be, #0a84ff, #bf5af2)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  WebkitTextFillColor: "transparent",
  color: "#0a84ff",
  fontWeight: 600,
} as const;

export interface PredictionPanelProps {
  match: Match;
  entries: VoteEntry[];
  current: { home: number; away: number };
  phase: ChipPhase;
  /** Deadline (ms) for submitting: kickoff + 5min. NaN = unknown. */
  closesAt: number;
  /** False when this match is beyond the current+next window (not yet open). */
  released: boolean;
  onVoted: () => void;
  /** Compact styling for the split (2-match) view — smaller notice boxes. */
  dense?: boolean;
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

function rowDisplay(phase: ChipPhase, status: PredictionStatus) {
  if (phase === "post") {
    const won = status === "winning";
    return {
      label: won ? "Acertou" : "Errou",
      tagColor: won ? "var(--signal-strong)" : "var(--ink-3)",
      rowBg: won ? "var(--signal-tint)" : "transparent",
      nameColor: won ? "var(--ink)" : "var(--ink-3)",
      numColor: won ? "var(--signal-strong)" : "var(--ink-3)",
    };
  }
  if (phase === "pre") {
    return { label: "", tagColor: "var(--ink-3)", rowBg: "transparent", nameColor: "var(--ink)", numColor: "var(--ink-2)" };
  }
  const win = status === "winning";
  const lose = status === "losing";
  return {
    label: win ? "Ganhando" : lose ? "Perdendo" : "Pode ganhar",
    tagColor: win ? "var(--signal-strong)" : "var(--ink-3)",
    rowBg: win ? "var(--signal-tint)" : "transparent",
    nameColor: lose ? "var(--ink-3)" : "var(--ink)",
    numColor: lose ? "var(--ink-3)" : "var(--signal-strong)",
  };
}

export function PredictionPanel({
  match,
  entries,
  current,
  phase,
  closesAt,
  released,
  onVoted,
  dense = false,
  transport = supabaseCastVote,
}: PredictionPanelProps) {
  // Smaller notice boxes in the split (2-match) view.
  const nMargin = dense ? "8px 14px 10px" : "12px 18px 14px";
  const nPad = dense ? "8px 11px" : "12px 14px";
  const nTitle = dense ? 9 : 11;
  const nBody = dense ? 10 : 13;
  const [user, setUser] = useState("");
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<SubmitOutcome | null>(null);
  // A confirmed name (in localStorage) is locked to its owner; the input is freed
  // only when there's no saved name (or the owner taps "trocar").
  const [nameLocked, setNameLocked] = useState(false);
  // Ticks every second and re-syncs on tab focus, so the countdown stays accurate
  // and the form locks at the deadline even after the tab was backgrounded.
  const now = useNow(1000);

  const draftKey = `baltfut_draft:${match.id}`;

  // Restore name + the in-progress score draft for THIS match so a reload
  // (auto-refresh / Modo Streamer) mid-typing doesn't lose the input. A confirmed
  // `baltfut_name` locks the input to its owner; otherwise the editable typing
  // draft (`baltfut_name_draft`) is restored so a new user doesn't lose it either.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    // A new match (auto-advance when one ends, or a manual switch) must clear any
    // stale submit message — otherwise "Esse nome já foi usado nesta partida."
    // from the previous match lingers on the next one.
    setOutcome(null);
    let locked = "";
    try {
      locked = localStorage.getItem("baltfut_name") || "";
    } catch {
      /* ignore */
    }
    if (locked) {
      setUser(locked);
      setNameLocked(true);
    } else {
      let draftName = "";
      try {
        draftName = localStorage.getItem("baltfut_name_draft") || "";
      } catch {
        /* ignore */
      }
      setUser(draftName);
      setNameLocked(false);
    }
    let h = "";
    let a = "";
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const d = JSON.parse(raw);
        if (typeof d.home === "string") h = d.home;
        if (typeof d.away === "string") a = d.away;
      }
    } catch {
      /* ignore */
    }
    setHome(h);
    setAway(a);
  }, [draftKey]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Auto-dismiss a submit error after a few seconds so it doesn't linger (it's
  // also cleared on match change above).
  useEffect(() => {
    if (!outcome || outcome.ok) return;
    const id = window.setTimeout(() => setOutcome(null), 5000);
    return () => window.clearTimeout(id);
  }, [outcome]);

  // Persist the draft a beat after typing stops. The name is only saved as an
  // (unlocking) draft until it's confirmed by a successful submit.
  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        if (!nameLocked) {
          const name = user.trim();
          if (name) localStorage.setItem("baltfut_name_draft", name);
          else localStorage.removeItem("baltfut_name_draft");
        }
        if (home || away) localStorage.setItem(draftKey, JSON.stringify({ home, away }));
        else localStorage.removeItem(draftKey);
      } catch {
        /* ignore */
      }
    }, 600);
    return () => window.clearTimeout(id);
  }, [user, home, away, draftKey, nameLocked]);

  function unlockName() {
    try {
      localStorage.removeItem("baltfut_name");
    } catch {
      /* ignore */
    }
    setUser("");
    setNameLocked(false);
    setOutcome(null);
  }

  const open = isPalpiteOpen(closesAt, now);
  const remaining = closesAt - now;
  // Show every palpite for the match here (live standings). The deadline filter
  // for integrity lives in the Ranking (rankSubs), not in this display list.
  const ranked = rankPredictions(entries, current);

  const title = !released
    ? "Palpites"
    : open
      ? "Palpite o placar"
      : phase === "post"
        ? "Vencedores dos palpites"
        : "Palpites";
  const emptyText =
    phase === "post"
      ? "Ninguém palpitou esta partida."
      : "Nenhum palpite ainda. Seja o primeiro.";

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = user.trim();
    // Reserved names belong to the app (e.g. the ChatGPT bot); the function
    // rejects them too — this is just instant feedback.
    if (isReservedName(name)) {
      setOutcome({ ok: false, message: "Esse nome é reservado. Escolha outro." });
      return;
    }
    // Name must be unique per match (instant check; the DB also enforces it).
    if (name && entries.some((x) => x.username.trim().toLowerCase() === name.toLowerCase())) {
      setOutcome({ ok: false, message: "Esse nome já foi usado nesta partida." });
      return;
    }
    setSubmitting(true);
    setOutcome(null);
    const result = await submitVote(
      {
        matchId: match.id,
        league: match.league,
        username: user,
        predHome: Number.parseInt(home, 10) || 0,
        predAway: Number.parseInt(away, 10) || 0,
      },
      transport,
    );
    setOutcome(result);
    setSubmitting(false);
    if (result.ok) {
      try {
        localStorage.setItem("baltfut_name", name); // confirmed → owned + locked
        localStorage.removeItem("baltfut_name_draft");
        localStorage.removeItem(draftKey);
      } catch {
        /* ignore */
      }
      setNameLocked(true);
      setHome("");
      setAway("");
      onVoted();
    }
  }

  const digits = (v: string) => v.replace(/[^0-9]/g, "").slice(0, 2);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: "1 1 auto", minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "14px 18px 0" }}>
        <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--ink-2)" }}>{title}</span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--ink-3)" }}>{ranked.length ? `${ranked.length} palpites` : ""}</span>
      </div>

      {!released ? (
        <div style={{ margin: nMargin, padding: nPad, borderRadius: 6, border: "1px solid var(--line-2)", background: "var(--bg)" }}>
          <div style={{ fontFamily: MONO, fontSize: nTitle, letterSpacing: "0.06em", textTransform: "uppercase", color: "#e5a23b", marginBottom: dense ? 3 : 4 }}>
            Palpites não liberados
          </div>
          <div style={{ fontSize: nBody, color: "var(--ink-2)" }}>
            Palpites não liberados ainda para essa partida, somente após a partida anterior à anterior completar.
          </div>
        </div>
      ) : open ? (
        <form onSubmit={handleSubmit} style={{ padding: "12px 18px 16px", display: "flex", flexDirection: "column", gap: 12, borderBottom: "1px solid var(--line)" }}>
          <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.04em", color: remaining < 60_000 ? "#e5484d" : "var(--signal-strong)" }}>
            Palpites encerrando em {formatCountdown(remaining)}
          </span>
          {nameLocked ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input value={user} readOnly aria-label="Seu nome" title="Seu nome fixo (reservado para você neste navegador)" style={{ ...inputStyle, flex: "1 1 auto", minWidth: 0, opacity: 0.85, cursor: "default" }} />
              <button type="button" onClick={unlockName} title="Usar outro nome" style={{ flex: "0 0 auto", fontFamily: MONO, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-3)", background: "transparent", border: "1px solid var(--line-2)", borderRadius: 4, padding: "8px 10px", cursor: "pointer" }}>
                Trocar
              </button>
            </div>
          ) : (
            <input value={user} onChange={(e) => setUser(e.target.value)} placeholder="Seu nome" maxLength={24} autoComplete="off" aria-label="Seu nome" style={inputStyle} />
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ flex: "0 0 auto", fontFamily: MONO, fontWeight: 500, fontSize: 15, color: "var(--ink)" }}>{match.home.abbreviation}</span>
            <input value={home} onChange={(e) => setHome(digits(e.target.value))} inputMode="numeric" placeholder="0" aria-label={`Gols ${match.home.abbreviation}`} style={{ ...inputStyle, flex: "1 1 0", minWidth: 0, textAlign: "center", fontFamily: MONO, fontSize: 16, padding: "9px 4px" }} />
            <span style={{ flex: "0 0 auto", fontFamily: MONO, fontSize: 13, color: "var(--ink-3)" }}>x</span>
            <input value={away} onChange={(e) => setAway(digits(e.target.value))} inputMode="numeric" placeholder="0" aria-label={`Gols ${match.away.abbreviation}`} style={{ ...inputStyle, flex: "1 1 0", minWidth: 0, textAlign: "center", fontFamily: MONO, fontSize: 16, padding: "9px 4px" }} />
            <span style={{ flex: "0 0 auto", fontFamily: MONO, fontWeight: 500, fontSize: 15, color: "var(--ink)" }}>{match.away.abbreviation}</span>
          </div>
          <button type="submit" disabled={submitting} style={{ fontFamily: MONO, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--signal-ink)", background: "var(--signal)", border: "none", borderRadius: 4, padding: "10px 12px", cursor: "pointer", opacity: submitting ? 0.7 : 1 }}>
            {submitting ? "Enviando…" : "Enviar palpite"}
          </button>
          {outcome && !outcome.ok ? <span role="alert" style={{ fontSize: 12, color: "#e5484d" }}>{outcome.message}</span> : null}
          {outcome?.ok ? <span style={{ fontSize: 12, color: "var(--signal-strong)" }}>Palpite enviado!</span> : null}
        </form>
      ) : (
        <div style={{ margin: nMargin, padding: nPad, borderRadius: 6, border: "1px solid var(--line-2)", background: "var(--bg)" }}>
          <div style={{ fontFamily: MONO, fontSize: nTitle, letterSpacing: "0.06em", textTransform: "uppercase", color: "#e5a23b", marginBottom: dense ? 3 : 4 }}>
            Palpites encerrados
          </div>
          <div style={{ fontSize: nBody, color: "var(--ink-2)" }}>
            Palpites encerrados para esta partida. Palpite a próxima — até 5min do início da partida.
          </div>
        </div>
      )}

      <div style={{ flex: "1 1 auto", padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", maxHeight: 420 }}>
        {ranked.length === 0 ? (
          <span style={{ fontSize: 13, color: "var(--ink-3)" }}>{emptyText}</span>
        ) : (
          ranked.map((v, i) => {
            const d = rowDisplay(phase, v.status);
            return (
              <div key={`${v.username}-${i}`} style={{ display: "flex", flexDirection: "column", gap: 4, padding: "7px 8px 9px", borderRadius: 4, borderBottom: "1px solid var(--line)", background: d.rowBg }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: 13, ...(isReservedName(v.username) ? rainbowNameStyle : { color: d.nameColor }) }}>{v.username}</span>
                  {d.label ? <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: d.tagColor }}>{d.label}</span> : null}
                </div>
                <span style={{ fontFamily: MONO, fontSize: 13, color: d.nameColor === "var(--ink-3)" ? "var(--ink-3)" : "var(--ink-2)" }}>
                  {match.home.abbreviation} [<span style={{ color: d.numColor }}>{v.predHome}</span>] x [<span style={{ color: d.numColor }}>{v.predAway}</span>] {match.away.abbreviation}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
