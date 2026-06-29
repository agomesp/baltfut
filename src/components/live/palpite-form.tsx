"use client";

import { useEffect, useState } from "react";
import type { Match, Side } from "@/lib/espn";
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
import { MY_NAME_EVENT } from "@/lib/use-my-name";
import { BRIC, FlagIcon, JB, LIME, SAIRA } from "@/components/live/bf-ui";

/** Knockout stages where a tie goes to penalties (so a pen-winner pick applies). */
const KO_STAGES = new Set(["round-of-32", "round-of-16", "quarterfinal", "semifinal", "third-place", "final"]);
export function isKnockoutStage(stage?: string): boolean {
  return stage != null && KO_STAGES.has(stage);
}

/** Knockout-only optional pick: "if it goes to pens, who wins?" (no score). A
 *  correct call is worth +0.5 in the ranking, so even a wrong score can score. */
function PenWinnerPick({ homeCode, awayCode, value, onChange, disabled }: { homeCode: string; awayCode: string; value: Side | null; onChange: (s: Side | null) => void; disabled: boolean }) {
  const opt = (side: Side, code: string) => {
    const on = value === side;
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(on ? null : side)}
        style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "7px 8px", borderRadius: 8, cursor: disabled ? "not-allowed" : "pointer", fontFamily: BRIC, fontWeight: 800, fontSize: 12, background: on ? "rgba(232,181,58,0.16)" : "rgba(255,255,255,0.03)", border: on ? "1px solid rgba(232,181,58,0.6)" : "1px solid rgba(255,255,255,0.1)", color: on ? "#f3d27a" : "#cfe3d6", opacity: disabled && !on ? 0.45 : 1 }}
      >
        <FlagIcon code={code} size={12} /> {code}
      </button>
    );
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "7px 9px", borderRadius: 9, border: "1px solid rgba(232,181,58,0.22)", background: "rgba(232,181,58,0.05)" }}>
      <span style={{ fontFamily: JB, fontSize: 8.5, letterSpacing: "0.05em", color: "#caa94a", textAlign: "center" }}>
        SE FOR AOS PÊNALTIS, QUEM VENCE? <span style={{ color: "#6f8a78" }}>(vale 0,5)</span>
      </span>
      <div style={{ display: "flex", gap: 8 }}>
        {opt("home", homeCode)}
        {opt("away", awayCode)}
      </div>
    </div>
  );
}

const clampScore = (n: number) => Math.max(SCORE_MIN, Math.min(SCORE_MAX, n));

/** − value + score stepper (Saira numeral). `disabled` greys it out (e.g. once
 *  the palpite for this game is locked in). */
export function Stepper({ label, accent, value, onChange, disabled = false }: { label: string; accent: string; value: number; onChange: (n: number) => void; disabled?: boolean }) {
  const btn = {
    width: 30,
    height: 30,
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.16)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    color: disabled ? "#3d4f44" : "#cfe3d6",
    cursor: disabled ? "not-allowed" : "pointer",
    background: "rgba(255,255,255,0.04)",
    opacity: disabled ? 0.5 : 1,
    flex: "none",
    userSelect: "none" as const,
  };
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontFamily: BRIC, fontWeight: 800, fontSize: 14, color: accent, marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button type="button" disabled={disabled} aria-label={`Menos ${label}`} style={btn} onClick={() => onChange(clampScore(value - 1))}>−</button>
        <span style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: 36, color: disabled ? "#6f8a78" : "#fff", width: 42, textAlign: "center", lineHeight: 0.8 }}>{value}</span>
        <button type="button" disabled={disabled} aria-label={`Mais ${label}`} style={btn} onClick={() => onChange(clampScore(value + 1))}>+</button>
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
      window.dispatchEvent(new Event(MY_NAME_EVENT));
    } catch {
      /* ignore */
    }
    setName(n);
    setLocked(true);
  };
  const unlock = () => {
    try {
      localStorage.removeItem("baltfut_name");
      window.dispatchEvent(new Event(MY_NAME_EVENT));
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
  padding: "7px 13px",
  color: "#fff",
  fontFamily: BRIC,
  fontSize: 13.5,
  outline: "none",
};

export function NameField({ name, setName, locked, onUnlock }: { name: string; setName: (s: string) => void; locked: boolean; onUnlock: () => void }) {
  // Label + input on ONE row (label left, input fills) to keep the bar short.
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <label style={{ flex: "none", fontFamily: JB, fontSize: 10, letterSpacing: "0.1em", color: "#7d9a86", whiteSpace: "nowrap" }}>SEU NOME</label>
      {locked ? (
        <>
          <input value={name} readOnly aria-label="Seu nome" title="Seu nome fixo neste navegador" style={{ ...inputStyle, flex: "1 1 auto", minWidth: 0, opacity: 0.85, cursor: "default" }} />
          <button type="button" onClick={onUnlock} title="Usar outro nome" style={{ flex: "none", alignSelf: "stretch", fontFamily: JB, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: "#9bb6a6", background: "transparent", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 11, padding: "0 12px", cursor: "pointer" }}>Trocar</button>
        </>
      ) : (
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="digite seu @usuário" maxLength={24} autoComplete="off" aria-label="Seu nome" style={{ ...inputStyle, flex: "1 1 auto", minWidth: 0 }} />
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

/**
 * Reserved → dup-name → submit, mirroring PredictionPanel's guards. Returns the
 * outcome. `penWinner` is the optional knockout shootout call. `allowExisting`
 * skips the dup-name guard for the "add a pen pick to my already-sent palpite"
 * flow — the server then fills pen_winner on the caller's existing row (score
 * stays), keyed on (match, ip), so it can only touch their own palpite.
 */
export async function castPalpite(
  match: Match,
  name: string,
  home: number,
  away: number,
  entries: VoteEntry[],
  transport: CastVoteTransport,
  penWinner: Side | null = null,
  allowExisting = false,
): Promise<SubmitOutcome> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, message: "Digite seu nome." };
  if (isReservedName(trimmed)) return { ok: false, message: "Esse nome é reservado. Escolha outro." };
  if (!allowExisting && entries.some((x) => x.username.trim().toLowerCase() === trimmed.toLowerCase())) {
    return { ok: false, message: "Esse nome já foi usado nesta partida." };
  }
  return submitVote({ matchId: match.id, league: match.league, username: trimmed, predHome: home, predAway: away, penWinner }, transport);
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
  const [penWinner, setPenWinner] = useState<Side | null>(null); // knockout-only pen pick
  const [sent, setSent] = useState(false); // locked once this browser's name has a palpite here
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<SubmitOutcome | null>(null);
  const now = useNow(1000);
  const open = isPalpiteOpen(closesAt, now);
  const canPen = isKnockoutStage(match.stage); // knockout tie → pen-winner pick applies
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
    setPenWinner(null);
    setSent(false); // a new match starts unlocked
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
    // Pen-add: already palpitado this knockout match (score locked) and now only
    // setting the pen winner. Re-send the existing score + the pick (allowExisting
    // skips the dup-name guard); the server fills pen_winner on the same row.
    const trimmed = name.trim();
    const mine = trimmed ? entries.find((x) => x.username.trim().toLowerCase() === trimmed.toLowerCase()) : undefined;
    const isPenAdd = mine != null && canPen && mine.penWinner == null;
    const result = isPenAdd
      ? await castPalpite(match, name, mine!.predHome, mine!.predAway, entries, transport, penWinner, true)
      : await castPalpite(match, name, home, away, entries, transport, penWinner, false);
    setOutcome(result);
    setSubmitting(false);
    if (result.ok) {
      if (!isPenAdd) {
        confirm(trimmed);
        setSent(true); // keep the submitted score on screen, but lock the form
      }
      try {
        localStorage.removeItem(draftKey);
      } catch {
        /* ignore */
      }
      onVoted(); // refetch so the stored pen pick shows + the form re-locks
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

  // Lock the form once this browser's name already has a palpite on this match —
  // either just submitted (`sent`) or found in the feed on reload. Greyed steppers
  // + "PALPITE ENVIADO ✓". EXCEPTION: on a knockout match you palpitado BEFORE
  // choosing a pen winner, keep the pen picker open so you can add it (the score
  // stays locked) and send just that — "penAddMode".
  const lowerName = name.trim().toLowerCase();
  const myEntry = lowerName ? entries.find((x) => x.username.trim().toLowerCase() === lowerName) : undefined;
  const alreadySent = sent || myEntry != null;
  const showHome = myEntry && !sent ? myEntry.predHome : home;
  const showAway = myEntry && !sent ? myEntry.predAway : away;
  const penStored = myEntry && !sent ? myEntry.penWinner ?? null : null;
  // Add a pen pick to an existing palpite: knockout, still open, palpitado, and no
  // pen call stored yet.
  const penAddMode = !sent && myEntry != null && canPen && open && penStored == null;
  // Pen picker shows the stored call when fully locked; otherwise the live draft.
  const showPen = penAddMode || !alreadySent ? penWinner : penStored;
  const penPickerDisabled = alreadySent && !penAddMode;
  // Submit gating: a name + (knockout) a pen pick to send a NEW palpite; just the
  // pen pick in penAddMode; nothing once fully locked.
  const nameMissing = !name.trim();
  const penMissing = canPen && !penWinner;
  const fullyLocked = alreadySent && !penAddMode;
  const blocked = penAddMode ? !penWinner : !alreadySent && (nameMissing || penMissing);
  const btnDisabled = submitting || fullyLocked || blocked;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <NameField name={name} setName={setName} locked={locked} onUnlock={() => { unlock(); setSent(false); setHome(0); setAway(0); setPenWinner(null); }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24, padding: "2px 0" }}>
        <Stepper label={homeAccentCode} accent="var(--bf-text)" value={showHome} onChange={setHome} disabled={alreadySent} />
        <span style={{ fontFamily: SAIRA, fontWeight: 500, fontSize: 22, color: "#42565b", paddingTop: 22 }}>×</span>
        <Stepper label={awayAccentCode} accent="var(--bf-text)" value={showAway} onChange={setAway} disabled={alreadySent} />
      </div>
      {canPen ? <PenWinnerPick homeCode={homeAccentCode} awayCode={awayAccentCode} value={showPen} onChange={setPenWinner} disabled={penPickerDisabled} /> : null}
      <button type="button" onClick={onSubmit} disabled={btnDisabled} style={{ ...submitBtnStyle, ...(fullyLocked ? { background: "rgba(255,255,255,0.05)", color: "#7d9a86", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "none", cursor: "not-allowed" } : blocked ? { opacity: 0.4, cursor: "not-allowed", boxShadow: "none" } : { opacity: submitting ? 0.7 : 1 }) }}>
        {submitting ? "ENVIANDO…" : fullyLocked ? "PALPITE ENVIADO ✓" : penAddMode ? "ENVIAR PÊNALTI →" : "ENVIAR PALPITE →"}
      </button>
      <div style={{ fontFamily: JB, fontSize: 9, color: blocked || penAddMode ? "#caa94a" : "#6f8a78", textAlign: "center", letterSpacing: "0.04em" }}>
        {fullyLocked
          ? "Você já palpitou esta partida · toque em Trocar para usar outro nome"
          : penAddMode
            ? penWinner
              ? "Envie seu palpite de pênaltis — o placar continua travado"
              : "Você já palpitou — escolha quem vence nos pênaltis e envie"
            : !open
              ? "Palpites encerrados — palpite a próxima partida."
              : nameMissing
                ? "Digite seu nome para enviar o palpite"
                : penMissing
                  ? "Escolha quem vence nos pênaltis para enviar"
                  : "1 palpite por pessoa · placar exato pontua no Ranking dos Subs"}
      </div>
      {open && !fullyLocked ? (
        <div style={{ fontFamily: JB, fontSize: 9.5, color: closesAt - now < 60_000 ? "#ff6b6b" : "#9bb6a6", textAlign: "center" }}>
          Fecha em {formatCountdown(closesAt - now)}
        </div>
      ) : null}
      {outcome && !outcome.ok ? <span role="alert" style={{ fontSize: 12, color: "#ff6b6b", textAlign: "center" }}>{outcome.message}</span> : null}
    </div>
  );
}
