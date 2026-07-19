"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { motion } from "framer-motion";
import { AccuracyBadge, Breathe, RollingNumber, Sheen, tapProps } from "@/components/live/fx";
import type { AccuracyRow } from "@/lib/champions/rankings";
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
import { penWindowClosed, penWindowHardClosed, penVoteVisible } from "@shared/deadline";

/** Manual pen-vote override broadcast by the admin (null = automatic). */
export type PenOverride = "open" | "closed" | null;
import { MY_NAME_EVENT, useMyName } from "@/lib/use-my-name";
import { BRIC, FlagIcon, JB, SAIRA } from "@/components/live/bf-ui";

/** Knockout stages where a tie goes to penalties (so a pen-winner pick applies). */
const KO_STAGES = new Set(["round-of-32", "round-of-16", "quarterfinal", "semifinal", "third-place", "final"]);
export function isKnockoutStage(stage?: string): boolean {
  return stage != null && KO_STAGES.has(stage);
}

/**
 * Knockout pen-winner vote, DECOUPLED from the score. Appears AFTER you've sent a
 * score palpite: tap a flag to call who wins on penalties (no score) and it
 * AUTO-SAVES on the spot. You can CHANGE it by tapping the other flag right up to
 * the moment the shootout starts (or, failing a clear ESPN signal, the end of extra
 * time, 120'); after that the picker closes and the last pick locks. Renders nothing
 * for non-knockout / no palpite / closed-and-never-picked. Worth +0.5 when correct.
 */
export function PenVote({ match, entries, onVoted, transport = supabaseCastVote, variant = "inline", override = null }: {
  match: Match;
  entries: VoteEntry[];
  onVoted: () => void;
  transport?: CastVoteTransport;
  /** "inline" = compact card (forms). "hero" = a tall column to sit beside the placar. */
  variant?: "inline" | "hero";
  /** Admin manual control: force the pen window open/closed (null = automatic). */
  override?: PenOverride;
}) {
  const myName = useMyName();
  const [saving, setSaving] = useState<Side | null>(null);
  const [optimistic, setOptimistic] = useState<Side | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const lower = myName ? myName.trim().toLowerCase() : "";
  const myEntry = lower ? entries.find((e) => e.username.trim().toLowerCase() === lower) : undefined;
  if (!isKnockoutStage(match.stage) || !myEntry) return null;
  // Hidden until ~10 min before pens (clock ≥ 110'), then auto-shows and stays
  // through the shootout/result — unless the admin manually liberated it ("open"),
  // which reveals it early.
  if (override !== "open" && !penVoteVisible({ state: match.state, detail: match.statusDetail, clock: match.displayClock })) {
    return null;
  }
  // Optimistic first, so an in-flight change shows immediately even when a pick is
  // already stored (`?? penWinner` alone would keep showing the old one).
  const chosen: Side | null = optimistic ?? myEntry.penWinner ?? null;
  // Effective close: a manual "closed" shuts it; a manual "open" keeps it open
  // PAST the 120' clock fallback but still yields to a real shootout/full-time
  // (the hard close). No override → the automatic rule.
  const windowClosed =
    override === "closed"
      ? true
      : override === "open"
        ? penWindowHardClosed({ state: match.state, detail: match.statusDetail })
        : penWindowClosed({ state: match.state, detail: match.statusDetail, clock: match.displayClock });
  const homeCode = match.home.abbreviation;
  const awayCode = match.away.abbreviation;

  const pick = async (side: Side) => {
    if (saving || !myName || side === chosen) return; // tapping the current pick is a no-op
    setSaving(side);
    setOptimistic(side); // show it immediately; revert if the server rejects
    setErr(null);
    const r = await castPalpite(match, myName, myEntry.predHome, myEntry.predAway, entries, transport, side, true);
    setSaving(null);
    if (r.ok) onVoted();
    else {
      setOptimistic(null);
      setErr(r.message);
    }
  };

  // ── Hero variant: a tall, prominent column that sits to the RIGHT of the placar. ──
  if (variant === "hero") {
    const heroBox: CSSProperties = { display: "flex", flexDirection: "column", gap: 9, flex: "none", width: 198, alignSelf: "stretch", minHeight: 0, padding: "13px 13px", borderRadius: 14, border: "1px solid rgba(232,181,58,0.5)", background: "linear-gradient(180deg, rgba(232,181,58,0.13), rgba(232,181,58,0.03))", boxShadow: "0 0 34px -12px rgba(232,181,58,0.5)" };
    const heroLabel = (
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: BRIC, fontWeight: 800, fontSize: 14, color: "#ffe6a8", lineHeight: 1.08 }}>QUEM VENCE<br />NOS PÊNALTIS?</div>
        <div style={{ fontFamily: JB, fontSize: 8.5, letterSpacing: "0.08em", color: "#caa94a", marginTop: 3 }}>VALE 0,5</div>
      </div>
    );
    if (windowClosed) {
      if (!chosen) return null;
      const code = chosen === "home" ? homeCode : awayCode;
      return (
        <div style={heroBox}>
          {heroLabel}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 9 }}>
            <FlagIcon code={code} size={46} />
            <span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: 24, color: "#ffe6a8" }}>{code}</span>
            <span style={{ fontFamily: JB, fontSize: 9, letterSpacing: "0.06em", color: "#caa94a" }}>✓ REGISTRADO</span>
          </div>
        </div>
      );
    }
    const heroBtn = (side: Side, code: string) => {
      const on = side === chosen;
      return (
        <button type="button" disabled={saving != null} onClick={() => pick(side)} className={saving === side ? "bf-saving" : undefined}
          style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px", borderRadius: 12, cursor: saving ? "wait" : on ? "default" : "pointer", background: on ? "rgba(232,181,58,0.24)" : "rgba(255,255,255,0.03)", border: on ? "2px solid rgba(232,181,58,0.95)" : "1px solid rgba(232,181,58,0.4)", color: on ? "#ffe6a8" : "#f3d27a", opacity: saving && saving !== side ? 0.4 : 1 }}>
          <FlagIcon code={code} size={38} />
          <span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: 20 }}>{code}{on ? " ✓" : ""}</span>
        </button>
      );
    };
    return (
      <div style={heroBox}>
        {heroLabel}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 9, minHeight: 0 }}>
          {heroBtn("home", homeCode)}
          {heroBtn("away", awayCode)}
        </div>
        <span style={{ fontFamily: JB, fontSize: 8, color: err ? "#ff8f8f" : "#6f8a78", textAlign: "center" }}>
          {err ?? (chosen ? "toque na outra p/ trocar" : "toque p/ escolher · salva na hora")}
        </span>
      </div>
    );
  }

  const box = { display: "flex", flexDirection: "column" as const, gap: 6, padding: "8px 10px", borderRadius: 9, border: "1px solid rgba(232,181,58,0.28)", background: "rgba(232,181,58,0.06)" };
  const label = (
    <span style={{ fontFamily: JB, fontSize: 8.5, letterSpacing: "0.05em", color: "#caa94a", textAlign: "center" }}>
      SE FOR AOS PÊNALTIS, QUEM VENCE? <span style={{ color: "#6f8a78" }}>(vale 0,5)</span>
    </span>
  );

  // Shootout started (or 120' passed): picker closes. Lock the last pick for whoever
  // called it; nothing for those who never did.
  if (windowClosed) {
    if (!chosen) return null;
    const code = chosen === "home" ? homeCode : awayCode;
    return (
      <div style={box}>
        {label}
        <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, fontFamily: BRIC, fontWeight: 800, fontSize: 13, color: "#f3d27a" }}>
          <FlagIcon code={code} size={13} /> {code} <span style={{ fontFamily: JB, fontSize: 9, color: "#caa94a" }}>✓ registrado</span>
        </div>
      </div>
    );
  }

  // Window open: both flags, the current pick highlighted; tapping the other CHANGES it.
  const btn = (side: Side, code: string) => {
    const on = side === chosen;
    return (
      <button
        type="button"
        disabled={saving != null}
        onClick={() => pick(side)}
        className={saving === side ? "bf-saving" : undefined}
        style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px", borderRadius: 8, cursor: saving ? "wait" : on ? "default" : "pointer", fontFamily: BRIC, fontWeight: 800, fontSize: 12, background: on ? "rgba(232,181,58,0.2)" : "rgba(255,255,255,0.03)", border: on ? "1px solid rgba(232,181,58,0.85)" : "1px solid rgba(232,181,58,0.4)", color: on ? "#ffe6a8" : "#f3d27a", opacity: saving && saving !== side ? 0.4 : 1 }}
      >
        <FlagIcon code={code} size={12} /> {code}{on ? " ✓" : ""}
      </button>
    );
  };

  return (
    <div style={box}>
      {label}
      <div style={{ display: "flex", gap: 8 }}>
        {btn("home", homeCode)}
        {btn("away", awayCode)}
      </div>
      <span style={{ fontFamily: JB, fontSize: 8, color: err ? "#ff8f8f" : "#6f8a78", textAlign: "center" }}>
        {err ?? (chosen ? "Pode trocar até começarem os pênaltis · toque na outra bandeira" : "Toque na bandeira — salva na hora · aberto até os pênaltis")}
      </span>
    </div>
  );
}

const clampScore = (n: number) => Math.max(SCORE_MIN, Math.min(SCORE_MAX, n));

/** − value + score stepper (Saira numeral). `disabled` greys it out (e.g. once
 *  the palpite for this game is locked in). */
export function Stepper({ label, accent, value, onChange, disabled = false, readOnly = false }: { label: string; accent: string; value: number; onChange: (n: number) => void; disabled?: boolean; readOnly?: boolean }) {
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
        {readOnly ? null : (
          <motion.button type="button" disabled={disabled} aria-label={`Menos ${label}`} style={btn} onClick={() => onChange(clampScore(value - 1))} {...(disabled ? {} : tapProps)}>
            −
          </motion.button>
        )}
        {/* The score rolls as you dial it in — the one control the whole pre-match
            screen is built around, so it should feel like a machine. */}
        <span style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: 36, color: disabled && !readOnly ? "#6f8a78" : "#fff", width: 42, textAlign: "center", lineHeight: 0.8 }}>
          <RollingNumber value={value} style={{ justifyContent: "center" }} />
        </span>
        {readOnly ? null : (
          <motion.button type="button" disabled={disabled} aria-label={`Mais ${label}`} style={btn} onClick={() => onChange(clampScore(value + 1))} {...(disabled ? {} : tapProps)}>
            +
          </motion.button>
        )}
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
  // Token (defaults to the lime) so the showpiece takeover retints ENVIAR to gold.
  background: "var(--bf-lime)",
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
  /** The viewer's own hit rate, shown beside the send button. Null (the default)
   *  when nobody has claimed a nickname on this browser — a visitor with no
   *  history shouldn't be shown a hollow 0%. */
  accuracy?: AccuracyRow | null;
  /** Hide the "Fecha em …" countdown (the pre-match hero shows it beside the pill). */
  hideCountdown?: boolean;
  onVoted: () => void;
  transport?: CastVoteTransport;
}

/** Full single-match pre-match form: name + two steppers + ENVIAR. */
export function PalpiteForm({ match, entries, closesAt, released = true, hideCountdown = false, accuracy = null, onVoted, transport = supabaseCastVote }: PalpiteFormProps) {
  const { name, setName, locked, confirm, unlock } = useNameLock();
  const [home, setHome] = useState(0);
  const [away, setAway] = useState(0);
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
    // Score palpite only — the pen winner is a separate, optional vote (PenVote)
    // that opens AFTER this lands and auto-saves on its own.
    const result = await castPalpite(match, name, home, away, entries, transport);
    setOutcome(result);
    setSubmitting(false);
    if (result.ok) {
      confirm(name.trim());
      setSent(true); // steppers + button give way to the pen vote (knockout) or lock
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

  const lowerName = name.trim().toLowerCase();
  const myEntry = lowerName ? entries.find((x) => x.username.trim().toLowerCase() === lowerName) : undefined;
  const alreadySent = sent || myEntry != null;
  const showHome = myEntry && !sent ? myEntry.predHome : home;
  const showAway = myEntry && !sent ? myEntry.predAway : away;
  const nameMissing = !name.trim();
  const nameField = (
    <NameField name={name} setName={setName} locked={locked} onUnlock={() => { unlock(); setSent(false); setHome(0); setAway(0); }} />
  );

  // Phase 1 (active) or phase 2 (sent). Once sent: the steppers go read-only (the
  // +/- buttons hide, the picked score stays) and the button locks to "PALPITE
  // ENVIADO". On a KNOCKOUT match the pen-winner vote is appended below — itself
  // hidden until ~10 min before pens (110'). A name is required to send.
  const blocked = !alreadySent && nameMissing;
  const btnDisabled = submitting || alreadySent || blocked;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {nameField}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24, padding: "2px 0" }}>
        <Stepper label={homeAccentCode} accent="var(--bf-text)" value={showHome} onChange={setHome} disabled={alreadySent} readOnly={alreadySent} />
        <span style={{ fontFamily: SAIRA, fontWeight: 500, fontSize: 22, color: "#42565b", paddingTop: 22 }}>×</span>
        <Stepper label={awayAccentCode} accent="var(--bf-text)" value={showAway} onChange={setAway} disabled={alreadySent} readOnly={alreadySent} />
      </div>
      {/* Light sweeps the button only while it can actually be pressed — once the
          palpite is in, the button goes quiet rather than nagging. */}
      {/* Send button, with the viewer's own hit rate alongside it — a running
          scoreline for the person about to add to it. */}
      <div style={{ display: "flex", alignItems: "stretch", gap: 9 }}>
      <Breathe scale={btnDisabled ? 1 : 1.012} seconds={2.6} style={{ flex: 1, minWidth: 0 }}>
      <Sheen seconds={2.8} radius={10} tint={btnDisabled ? "transparent" : "rgba(255,255,255,0.5)"}>
      <button type="button" onClick={onSubmit} disabled={btnDisabled} style={{ ...submitBtnStyle, ...(alreadySent ? { background: "rgba(255,255,255,0.05)", color: "#7d9a86", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "none", cursor: "not-allowed" } : blocked ? { opacity: 0.4, cursor: "not-allowed", boxShadow: "none" } : { opacity: submitting ? 0.7 : 1 }) }}>
        {submitting ? "ENVIANDO…" : alreadySent ? "PALPITE ENVIADO ✓" : "ENVIAR PALPITE →"}
      </button>
      </Sheen>
      </Breathe>
      <AccuracyBadge row={accuracy} accent="var(--bf-lime)" />
      </div>
      <div style={{ fontFamily: JB, fontSize: 9, color: blocked ? "#caa94a" : "#6f8a78", textAlign: "center", letterSpacing: "0.04em" }}>
        {alreadySent
          ? "Você já palpitou esta partida · toque em Trocar para usar outro nome"
          : !open
            ? "Palpites encerrados — palpite a próxima partida."
            : nameMissing
              ? "Digite seu nome para enviar o palpite"
              : "1 palpite por pessoa · placar exato pontua no Ranking dos Subs"}
      </div>
      {open && !alreadySent && !hideCountdown ? (
        <div style={{ fontFamily: JB, fontSize: 9.5, color: closesAt - now < 60_000 ? "#ff6b6b" : "#9bb6a6", textAlign: "center" }}>
          Fecha em {formatCountdown(closesAt - now)}
        </div>
      ) : null}
      {outcome && !outcome.ok ? <span role="alert" style={{ fontSize: 12, color: "#ff6b6b", textAlign: "center" }}>{outcome.message}</span> : null}
      {alreadySent && canPen ? <PenVote match={match} entries={entries} onVoted={onVoted} transport={transport} /> : null}
    </div>
  );
}
