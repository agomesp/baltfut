"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Match } from "@/lib/espn";
import { buildKnockout } from "@/lib/espn";
import { teamNamePt } from "@/lib/team-names";
import {
  resolveBracketPicks,
  togglePick,
  realWinnersByPos,
  scoreBracketPicks,
  posKey,
  ROUND_LABELS,
  type PickTie,
  type PickVerdict,
} from "@/lib/bracket-picks";
import { ConnectedBracket, type BracketRound } from "@/components/connected-bracket";
import { useNameLock, NameField } from "@/components/live/palpite-form";
import { BRIC, JB, SAIRA, LIME, DIM, DIM_2, GOLD, FlagIcon, FlagCrest, ViewHeader, teamAccent } from "@/components/live/bf-ui";

const STORAGE_KEY = "baltfut_bracket_palpite";
const GREEN = "#3ee65f";
const RED = "#ff4d5e";
const SLATE = "#93a7c4"; // locked "real result" (not the user's pick)
const card = { borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" } as const;
const colHead = { fontFamily: JB, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase" as const, paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.07)", marginBottom: 6 };

type Tone = "pick" | "correct" | "wrong" | "real";
const TONE: Record<Tone, { fg: string; bg: string }> = {
  pick: { fg: LIME, bg: "rgba(200,255,45,0.12)" },
  correct: { fg: GREEN, bg: "rgba(62,230,95,0.12)" },
  wrong: { fg: RED, bg: "rgba(255,77,94,0.12)" },
  real: { fg: SLATE, bg: "rgba(147,167,196,0.12)" },
};

interface SavedPalpite {
  nickname: string;
  picks: Record<string, string>;
  savedAt: string;
}

/** One side of a tie. Highlighted (with `tone`) when it's the advancer — the
 *  user's pick (lime / green / red) or, on a locked tie, the real winner (slate). */
function TeamSlot({ code, tone, marker, clickable, onClick }: {
  code: string | null;
  tone: Tone | null;
  marker: string;
  clickable: boolean;
  onClick: () => void;
}) {
  const t = tone ? TONE[tone] : null;
  return (
    <div
      onClick={clickable ? onClick : undefined}
      role={clickable ? "button" : undefined}
      style={{
        display: "flex", alignItems: "center", gap: 8, padding: "8px 11px",
        background: t ? t.bg : "transparent", cursor: clickable ? "pointer" : "default",
        opacity: code ? 1 : 0.4, userSelect: "none",
      }}
    >
      {code ? <FlagIcon code={code} size={12} /> : <span style={{ width: 12 }} />}
      <span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: 13, color: t ? t.fg : "#f1f7f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {code ?? "—"}
      </span>
      {code ? <span style={{ fontFamily: BRIC, fontSize: 11, color: DIM, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{teamNamePt(code, code)}</span> : null}
      {marker ? <span style={{ marginLeft: "auto", fontFamily: JB, fontSize: 10, color: t ? t.fg : DIM, flex: "none" }}>{marker}</span> : null}
    </div>
  );
}

function PickTieCard({ tie, round, tieIndex, verdict, editing, onPick }: {
  tie: PickTie; round: number; tieIndex: number; verdict: PickVerdict | null; editing: boolean; onPick: (round: number, tie: number, team: string) => void;
}) {
  const clickable = editing && !tie.locked && !!tie.home && !!tie.away;

  // Which team is highlighted, and how.
  let hi: string | null = null;
  let tone: Tone | null = null;
  let marker = "";
  if (tie.locked) {
    hi = tie.realWinner; // null while live
    tone = "real";
    marker = "🔒";
  } else if (tie.pickedWinner) {
    hi = tie.pickedWinner;
    tone = verdict === "correct" ? "correct" : verdict === "wrong" ? "wrong" : "pick";
    marker = "▸";
  }

  const border =
    tie.live ? "rgba(255,77,94,0.55)" :
    verdict === "correct" ? "rgba(62,230,95,0.4)" :
    verdict === "wrong" ? "rgba(255,77,94,0.4)" :
    tie.locked ? "rgba(147,167,196,0.28)" : "rgba(255,255,255,0.08)";

  const slot = (code: string | null) => (
    <TeamSlot code={code} tone={code && code === hi ? tone : null} marker={code && code === hi ? marker : ""} clickable={clickable} onClick={() => code && onPick(round, tieIndex, code)} />
  );

  return (
    <div style={{ ...card, borderColor: border, position: "relative" }}>
      {tie.live ? (
        <span style={{ position: "absolute", top: -7, right: 8, fontFamily: JB, fontSize: 8, letterSpacing: "0.08em", color: "#fff", background: RED, borderRadius: 4, padding: "1px 5px" }}>● AO VIVO</span>
      ) : null}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>{slot(tie.home)}</div>
      {slot(tie.away)}
    </div>
  );
}

export function BracketPalpiteView({ matches }: { matches: Match[] }) {
  const { name, setName, locked: nameLocked, confirm } = useNameLock();
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<SavedPalpite | null>(null);

  const columns = useMemo(() => buildKnockout(matches), [matches]);
  const drawn = useMemo(() => {
    const col = columns.find((c) => c.slug === "round-of-32");
    return !!col && col.matches.length === 16;
  }, [columns]);
  const realWinners = useMemo(() => realWinnersByPos(columns), [columns]);

  // Load a previously-saved palpite once (it locks the bracket + shows green/red).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw) as SavedPalpite;
        if (s?.picks) { setSaved(s); setPicks(s.picks); }
      }
    } catch { /* ignore */ }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const isSaved = saved != null;
  const { rounds, champion } = useMemo(() => resolveBracketPicks(columns, picks, isSaved), [columns, picks, isSaved]);
  const score = useMemo(() => scoreBracketPicks(rounds, realWinners), [rounds, realWinners]);

  const onPick = useCallback((round: number, tie: number, team: string) => {
    if (isSaved) return;
    setPicks((prev) => resolveBracketPicks(columns, togglePick(prev, round, tie, team)).picks);
  }, [isSaved, columns]);

  const onSave = useCallback(() => {
    const finalName = name.trim();
    if (!finalName || !champion) return;
    if (!nameLocked) confirm(finalName);
    const rec: SavedPalpite = { nickname: finalName, picks: resolveBracketPicks(columns, picks).picks, savedAt: new Date().toISOString() };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(rec)); } catch { /* ignore */ }
    setSaved(rec);
  }, [name, champion, nameLocked, confirm, columns, picks]);

  // TEST-ONLY: let the tester redo a saved palpite (the spec locks it in prod).
  const reset = useCallback(() => {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    setSaved(null);
    setPicks({});
  }, []);

  if (!drawn) {
    return (
      <section>
        <ViewHeader label="// PALPITES · CHAVEAMENTO" sub="palpite o mata-mata inteiro — clique no vencedor de cada jogo até a final" />
        <div style={{ ...card, padding: "40px 24px", textAlign: "center", fontFamily: BRIC, color: DIM }}>
          O mata-mata ainda não foi sorteado.
        </div>
      </section>
    );
  }

  const bracketRounds: BracketRound[] = rounds.map((ties, r) => ({
    key: `r${r}`,
    label: <div style={{ ...colHead, color: r === 4 ? LIME : "#9bb6a6" }}>{ROUND_LABELS[r]}</div>,
    items: ties.map((tie, i) => (
      <PickTieCard key={`${r}-${i}`} tie={tie} round={r} tieIndex={i} verdict={isSaved ? score.byPos[posKey(r, i)] ?? null : null} editing={!isSaved} onPick={onPick} />
    )),
  }));

  const champVerdict = isSaved ? score.byPos[posKey(4, 0)] : null;
  const champColor = champVerdict === "correct" ? GREEN : champVerdict === "wrong" ? RED : rounds[4][0].locked ? SLATE : LIME;
  const trailing = {
    width: 190,
    label: <div style={{ ...colHead, color: LIME }}>Campeão</div>,
    content: (
      <div style={{ borderRadius: 14, border: `1px solid ${champion ? "rgba(200,255,45,0.45)" : "rgba(255,255,255,0.1)"}`, background: "linear-gradient(180deg, rgba(200,255,45,0.06), transparent)", padding: "22px 16px", textAlign: "center" as const }}>
        {champion ? (
          <>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
              <FlagCrest code={champion} accent={teamAccent(champion)} size={52} />
            </div>
            <div style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: 28, lineHeight: 1, color: champColor }}>{champion}</div>
            <div style={{ fontFamily: JB, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9bb6a6", marginTop: 8 }}>seu campeão</div>
          </>
        ) : (
          <div style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: 40, color: "#54706a" }}>?</div>
        )}
      </div>
    ),
  };

  return (
    <section>
      <ViewHeader label="// PALPITES · CHAVEAMENTO" sub="palpite o mata-mata inteiro — jogos que já começaram ficam travados no resultado real 🔒" />

      {/* Name + save bar */}
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12, ...card, padding: "12px 16px", marginBottom: 14 }}>
        <div style={{ flex: "1 1 240px", minWidth: 0 }}>
          {isSaved ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: JB, fontSize: 11, color: "#9bb6a6" }}>
              <span style={{ color: "#7d9a86" }}>PALPITE DE</span>
              <span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: 14, color: "#f1f7f0" }}>{saved!.nickname}</span>
            </span>
          ) : (
            <NameField name={name} setName={setName} locked={nameLocked} onUnlock={() => { /* keep name; Trocar handled by useNameLock */ }} />
          )}
        </div>
        {isSaved ? (
          <>
            <span style={{ fontFamily: JB, fontSize: 11, color: "#9bb6a6" }}>
              PONTOS: <span style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: 18, color: GOLD }}>{score.total.toFixed(1).replace(".", ",")}</span>
            </span>
            <button type="button" onClick={reset} title="Refazer (apenas para teste local)" style={{ flex: "none", fontFamily: JB, fontSize: 9.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "#9bb6a6", background: "transparent", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 9, padding: "8px 12px", cursor: "pointer" }}>↺ refazer (teste)</button>
          </>
        ) : (
          <button
            type="button"
            onClick={onSave}
            disabled={!champion || !name.trim()}
            title={!champion ? "Escolha o vencedor de cada jogo até a final" : !name.trim() ? "Digite seu nome" : "Salvar"}
            style={{ flex: "none", fontFamily: BRIC, fontWeight: 800, fontSize: 13, letterSpacing: "0.02em", padding: "10px 18px", borderRadius: 11, border: "none", cursor: champion && name.trim() ? "pointer" : "not-allowed", background: champion && name.trim() ? LIME : "rgba(255,255,255,0.08)", color: champion && name.trim() ? "#0f1f02" : "#6f8a78" }}
          >
            Salvar palpite de chaveamento →
          </button>
        )}
      </div>

      {/* Legend */}
      <div style={{ fontFamily: JB, fontSize: 9, letterSpacing: "0.04em", color: DIM_2, margin: "0 4px 8px" }}>
        {isSaved ? (
          <><span style={{ color: GREEN }}>verde = acertou</span> · <span style={{ color: RED }}>vermelho = errou</span> · <span style={{ color: SLATE }}>🔒 resultado real</span> · restantes = a decidir · 0,2 por vencedor · 1 pelo campeão</>
        ) : (
          <>clique no time que avança · clique de novo para desfazer · <span style={{ color: SLATE }}>🔒 já começou (travado)</span> · 0,2 por vencedor · 1 pelo campeão</>
        )}
      </div>

      <div style={{ overflowX: "auto", paddingBottom: 12 }}>
        <ConnectedBracket rounds={bracketRounds} colWidth={244} unitHeight={84} gap={24} trailing={trailing} />
      </div>
    </section>
  );
}
