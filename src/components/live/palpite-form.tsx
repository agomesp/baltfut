"use client";

import { useEffect, useState } from "react";
import type { Match } from "@/lib/espn";
import { useNow } from "@/lib/use-now";
import {
  submitVote,
  supabaseCastVote,
  SCORE_MAX,
  SCORE_MIN,
  type CastVoteTransport,
  type SubmitOutcome,
  type VoteEntry,
} from "@/lib/votes";
import { isPalpiteOpen, formatCountdown } from "@/lib/palpite";
import { isReservedName } from "@shared/name-claim";
import { BRIC, JB, LIME, SAIRA } from "@/components/live/bf-ui";

const clampScore = (n: number) => Math.max(SCORE_MIN, Math.min(SCORE_MAX, n));

/** − value + score stepper (Saira numeral). */
export function Stepper({ label, accent, value, onChange }: { label: string; accent: string; value: number; onChange: (n: number) => void }) {
  const btn = {
    width: 30,
    height: 30,
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.16)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    color: "#cfe3d6",
    cursor: "pointer",
    background: "rgba(255,255,255,0.04)",
    flex: "none",
    userSelect: "none" as const,
  };
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontFamily: BRIC, fontWeight: 800, fontSize: 14, color: accent, marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button type="button" aria-label={`Menos ${label}`} style={btn} onClick={() => onChange(clampScore(value - 1))}>−</button>
        <span style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: 36, color: "#fff", width: 42, textAlign: "center", lineHeight: 0.8 }}>{value}</span>
        <button type="button" aria-label={`Mais ${label}`} style={btn} onClick={() => onChange(clampScore(value + 1))}>+</button>
      </div>
    </div>
  );
}

/** Confirmed-name lock shared across the single + duo pre-match forms. */
export function useNameLock() {
  const [name, setName] = useState("");
  const [locked, setLocked] = useState(false);
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const saved = localStorage.getItem("baltfut_name");
      if (saved) {
        setName(saved);
        setLocked(true);
      } else {
        setName(localStorage.getItem("baltfut_name_draft") || "");
      }
    } catch {
      /* ignore */
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Persist the in-progress name (debounced) so a reload mid-typing doesn't lose
  // it. Only while unconfirmed — a locked name already owns its slot.
  useEffect(() => {
    if (locked) return;
    const id = window.setTimeout(() => {
      try {
        const n = name.trim();
        if (n) localStorage.setItem("baltfut_name_draft", n);
        else localStorage.removeItem("baltfut_name_draft");
      } catch {
        /* ignore */
      }
    }, 500);
    return () => window.clearTimeout(id);
  }, [name, locked]);

  const confirm = (n: string) => {
    try {
      localStorage.setItem("baltfut_name", n);
      localStorage.removeItem("baltfut_name_draft");
    } catch {
      /* ignore */
    }
    setName(n);
    setLocked(true);
  };
  const unlock = () => {
    try {
      localStorage.removeItem("baltfut_name");
    } catch {
      /* ignore */
    }
    setName("");
    setLocked(false);
  };
  return { name, setName, locked, confirm, unlock };
}

const inputStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  background: "rgba(0,0,0,0.3)",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 10,
  padding: "9px 13px",
  color: "#fff",
  fontFamily: BRIC,
  fontSize: 13.5,
  outline: "none",
};

export function NameField({ name, setName, locked, onUnlock }: { name: string; setName: (s: string) => void; locked: boolean; onUnlock: () => void }) {
  return (
    <div>
      <label style={{ fontFamily: JB, fontSize: 10, letterSpacing: "0.1em", color: "#7d9a86" }}>SEU NOME</label>
      {locked ? (
        <div style={{ display: "flex", gap: 8, marginTop: 7 }}>
          <input value={name} readOnly aria-label="Seu nome" title="Seu nome fixo neste navegador" style={{ ...inputStyle, opacity: 0.85, cursor: "default" }} />
          <button type="button" onClick={onUnlock} title="Usar outro nome" style={{ flex: "none", fontFamily: JB, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: "#9bb6a6", background: "transparent", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 11, padding: "0 12px", cursor: "pointer" }}>Trocar</button>
        </div>
      ) : (
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="digite seu @usuário" maxLength={24} autoComplete="off" aria-label="Seu nome" style={{ ...inputStyle, marginTop: 7 }} />
      )}
    </div>
  );
}

const submitBtnStyle = {
  cursor: "pointer",
  textAlign: "center" as const,
  background: LIME,
  color: "#0f1f02",
  fontFamily: BRIC,
  fontWeight: 800,
  fontSize: 14,
  padding: 11,
  borderRadius: 11,
  border: "none",
  boxShadow: "0 0 26px -8px rgba(200,255,45,0.6)",
  width: "100%",
};

/** Reserved → dup-name → submit, mirroring PredictionPanel's guards. Returns the outcome. */
export async function castPalpite(
  match: Match,
  name: string,
  home: number,
  away: number,
  entries: VoteEntry[],
  transport: CastVoteTransport,
): Promise<SubmitOutcome> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, message: "Digite seu nome." };
  if (isReservedName(trimmed)) return { ok: false, message: "Esse nome é reservado. Escolha outro." };
  if (entries.some((x) => x.username.trim().toLowerCase() === trimmed.toLowerCase())) {
    return { ok: false, message: "Esse nome já foi usado nesta partida." };
  }
  return submitVote({ matchId: match.id, league: match.league, username: trimmed, predHome: home, predAway: away }, transport);
}

export interface PalpiteFormProps {
  match: Match;
  entries: VoteEntry[];
  closesAt: number;
  /** False when the match is beyond the current+next kickoff-group window (locked). */
  released?: boolean;
  onVoted: () => void;
  transport?: CastVoteTransport;
}

/** Full single-match pre-match form: name + two steppers + ENVIAR. */
export function PalpiteForm({ match, entries, closesAt, released = true, onVoted, transport = supabaseCastVote }: PalpiteFormProps) {
  const { name, setName, locked, confirm, unlock } = useNameLock();
  const [home, setHome] = useState(0);
  const [away, setAway] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<SubmitOutcome | null>(null);
  const now = useNow(1000);
  const open = isPalpiteOpen(closesAt, now);
  const homeAccentCode = match.home.abbreviation;
  const awayAccentCode = match.away.abbreviation;
  const draftKey = `baltfut_draft:${match.id}`;

  // Restore the in-progress score for THIS match (and reset when the match
  // changes) so a reload mid-typing doesn't lose it.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    let h = 0;
    let a = 0;
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const d = JSON.parse(raw);
        h = clampScore(Number(d.home) || 0);
        a = clampScore(Number(d.away) || 0);
      }
    } catch {
      /* ignore */
    }
    setHome(h);
    setAway(a);
  }, [draftKey]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Persist the score draft a beat after a change.
  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        if (home || away) localStorage.setItem(draftKey, JSON.stringify({ home, away }));
        else localStorage.removeItem(draftKey);
      } catch {
        /* ignore */
      }
    }, 500);
    return () => window.clearTimeout(id);
  }, [home, away, draftKey]);

  useEffect(() => {
    if (!outcome || outcome.ok) return;
    const id = window.setTimeout(() => setOutcome(null), 5000);
    return () => window.clearTimeout(id);
  }, [outcome]);

  async function onSubmit() {
    if (!open) {
      setOutcome({ ok: false, message: "Palpites encerrados para esta partida." });
      return;
    }
    setSubmitting(true);
    setOutcome(null);
    const result = await castPalpite(match, name, home, away, entries, transport);
    setOutcome(result);
    setSubmitting(false);
    if (result.ok) {
      confirm(name.trim());
      setHome(0);
      setAway(0);
      try {
        localStorage.removeItem(draftKey);
      } catch {
        /* ignore */
      }
      onVoted();
    }
  }

  // Far-away games (beyond the current + next kickoff group) aren't open for
  // palpites yet — show the locked notice instead of the form.
  if (!released) {
    return (
      <div style={{ borderRadius: 11, border: "1px solid rgba(255,179,71,0.25)", background: "rgba(255,179,71,0.05)", padding: "14px 16px" }}>
        <div style={{ fontFamily: JB, fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "#ffb347", marginBottom: 5 }}>Palpites não liberados</div>
        <div style={{ fontFamily: BRIC, fontSize: 13, color: "#cfd9d1", lineHeight: 1.4 }}>
          Esta partida ainda não abriu para palpites — ela libera após a partida anterior à anterior terminar.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <NameField name={name} setName={setName} locked={locked} onUnlock={unlock} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24, padding: "2px 0" }}>
        <Stepper label={homeAccentCode} accent="var(--bf-text)" value={home} onChange={setHome} />
        <span style={{ fontFamily: SAIRA, fontWeight: 500, fontSize: 22, color: "#42565b", paddingTop: 22 }}>×</span>
        <Stepper label={awayAccentCode} accent="var(--bf-text)" value={away} onChange={setAway} />
      </div>
      <button type="button" onClick={onSubmit} disabled={submitting} style={{ ...submitBtnStyle, opacity: submitting ? 0.7 : 1 }}>
        {submitting ? "ENVIANDO…" : "ENVIAR PALPITE →"}
      </button>
      <div style={{ fontFamily: JB, fontSize: 9, color: "#6f8a78", textAlign: "center", letterSpacing: "0.04em" }}>
        {open ? "1 palpite por pessoa · placar exato pontua no Ranking dos Subs" : "Palpites encerrados — palpite a próxima partida."}
      </div>
      {open ? (
        <div style={{ fontFamily: JB, fontSize: 9.5, color: closesAt - now < 60_000 ? "#ff6b6b" : "#9bb6a6", textAlign: "center" }}>
          Fecha em {formatCountdown(closesAt - now)}
        </div>
      ) : null}
      {outcome && !outcome.ok ? <span role="alert" style={{ fontSize: 12, color: "#ff6b6b", textAlign: "center" }}>{outcome.message}</span> : null}
      {outcome?.ok ? <span style={{ fontSize: 12, color: LIME, textAlign: "center" }}>Palpite enviado!</span> : null}
    </div>
  );
}
