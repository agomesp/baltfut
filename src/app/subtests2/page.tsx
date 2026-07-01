"use client";

// /subtests — Subs draft game (LOCAL-ONLY spike, mocked data). Day 1: subs claim a
// country, then a snake-ish category draft fills every squad. Matches + bracket are
// mocked later. See src/lib/subs-draft/*.

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  CATS,
  CAT_ABBR,
  CAT_COLOR,
  COUNTRIES,
  SQUAD_SIZE,
} from "@/lib/subs-draft/data";
import {
  addBots,
  addTeam,
  autoPick,
  autoPickWeighted,
  availableForCurrent,
  currentCat,
  initialState,
  onClockTeamId,
  pick,
  pickNumber,
  removeTeam,
  skip,
  squadCount,
  startDraft,
  type DraftState,
  type Team,
} from "@/lib/subs-draft/engine";
import { fillTo48, goToGroups, mockTournament } from "@/lib/subs-draft/tournament";
import { useWatchHost } from "@/lib/subs-draft/use-watch-host";
import TournamentView from "@/components/subs-draft2/tournament-view";
import GroupsView from "@/components/subs-draft2/groups-view";
import WatchView from "@/components/subs-draft2/watch-view";
import { FlagIcon } from "@/components/live/bf-ui";
import { teamNamePt } from "@/lib/team-names";

const LIME = "#c8ff2d";
const BG = "#0a120d";
const CARD = "#11201700";
const INK = "#e7f0e9";
const DIM = "#7e8f84";
const LINE = "rgba(200,255,45,0.14)";
const DISP = "var(--font-bric, system-ui)";
const MONO = "var(--font-jb, ui-monospace)";

export default function SubtestsPage() {
  const [state, setState] = useState<DraftState>(initialState);
  const [hostId, setHostId] = useState<string | null>(null); // set → this tab is HOSTING
  const hosting = hostId != null;
  const { viewers, broadcast } = useWatchHost(hosting, hostId ?? "");

  // ?watch=<id> → this tab is a VIEWER. useSyncExternalStore reads window SSR-safely
  // (server snapshot = null → no hydration mismatch, no setState-in-effect).
  const watchId = useSyncExternalStore(
    useCallback(() => () => {}, []),
    () => new URLSearchParams(window.location.search).get("watch"),
    () => null,
  );

  const onBroadcast = hosting ? broadcast : undefined;
  const watchable = state.phase === "groups" || state.phase === "bracket";

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: `radial-gradient(120% 80% at 50% -10%, #11241a 0%, ${BG} 60%)`,
        color: INK,
        fontFamily: "var(--font-body, system-ui)",
        padding: "28px 20px 80px",
      }}
    >
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        {watchId ? (
          <WatchView id={watchId} />
        ) : (
          <>
            <Masthead phase={state.phase} teams={state.teams.length} />
            {/* watch-together needs a deterministic field the viewer can rebuild from
                fillTo48([]); a drafted roster isn't reproducible, so only host a
                fully-mock Copa (the "Simular Copa completa" path). */}
            {watchable && (
              <HostBar
                hosting={hosting}
                viewers={viewers}
                hostId={hostId}
                canHost={state.field.length > 0 && state.field.every((t) => t.owner.includes("🤖"))}
                onStart={() => setHostId(Math.random().toString(36).slice(2, 8))}
                onStop={() => setHostId(null)}
              />
            )}
            {state.phase === "lobby" && <Lobby state={state} setState={setState} />}
            {state.phase === "draft" && <Draft state={state} setState={setState} />}
            {state.phase === "done" && <Done state={state} setState={setState} />}
            {state.phase === "groups" && (
              <GroupsView
                teams={state.field}
                onBroadcast={onBroadcast}
                onAdvance={(q32) => setState({ ...state, phase: "bracket", field: state.field.filter((t) => q32.includes(t.id)) })}
              />
            )}
            {state.phase === "bracket" && <TournamentView teams={state.field} onBroadcast={onBroadcast} />}
          </>
        )}
      </div>
    </main>
  );
}

/** Host controls for watch-together — start a room, share the ?watch link, see the
 * viewer count. The channel persists across the groups→bracket transition (it lives
 * here, in the page). */
function HostBar({ hosting, viewers, hostId, canHost, onStart, onStop }: { hosting: boolean; viewers: number; hostId: string | null; canHost: boolean; onStart: () => void; onStop: () => void }) {
  const [copied, setCopied] = useState(false);
  const link = hostId && typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}?watch=${hostId}` : "";
  return (
    <section style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "10px 14px", borderRadius: 12, border: `1px solid ${hosting ? LIME : LINE}`, background: hosting ? "rgba(200,255,45,0.06)" : "transparent", marginBottom: 16 }}>
      {!hosting ? (
        <>
          <button onClick={onStart} disabled={!canHost} style={{ ...primaryBtn, width: "auto", padding: "9px 16px", opacity: canHost ? 1 : 0.4, cursor: canHost ? "pointer" : "not-allowed" }}>📡 Transmitir ao vivo</button>
          <span style={{ fontSize: 12, color: DIM }}>
            {canHost ? "Assista junto: cada pessoa vê a MESMA partida, sincronizada pelo relógio." : "Transmissão só na Copa mockada (\"Simular Copa completa\") — um elenco sorteado não é reproduzível pro público."}
          </span>
        </>
      ) : (
        <>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: DISP, fontWeight: 800, color: LIME }}>
            <span style={{ width: 9, height: 9, borderRadius: 999, background: "#ff4d4d", boxShadow: "0 0 8px #ff4d4d" }} /> Transmitindo
          </span>
          <span style={{ fontFamily: MONO, fontSize: 12, color: INK }}>👥 {viewers} assistindo</span>
          <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} style={{ flex: 1, minWidth: 180, padding: "7px 10px", borderRadius: 8, border: `1px solid ${LINE}`, background: "rgba(0,0,0,0.25)", color: INK, fontFamily: MONO, fontSize: 12 }} />
          <button onClick={() => { if (link) { void navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); } }} style={{ ...smallBtn, width: "auto" }}>{copied ? "✓ Copiado" : "Copiar link"}</button>
          <button onClick={onStop} style={{ ...smallBtn, width: "auto" }}>⏹ Parar</button>
        </>
      )}
    </section>
  );
}

function Masthead({ phase, teams }: { phase: string; teams: number }) {
  const step =
    phase === "lobby" ? "Dia 1 · Montagem dos times"
    : phase === "draft" ? "Dia 1 · Draft em andamento"
    : phase === "groups" ? "Fase de grupos · 12 grupos"
    : phase === "bracket" ? "Mata-mata · 32 times"
    : "Times montados";
  return (
    <header style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap", marginBottom: 22 }}>
      <h1 style={{ fontFamily: DISP, fontSize: 30, fontWeight: 800, letterSpacing: -0.5, margin: 0 }}>
        SUBS <span style={{ color: LIME }}>DRAFT</span>
      </h1>
      <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 800, color: "#0a120d", background: "#f2a93b", padding: "2px 7px", borderRadius: 999, letterSpacing: 0.5, alignSelf: "center" }}>
        PROTÓTIPO IK · V2
      </span>
      <span style={{ fontFamily: MONO, fontSize: 12, color: DIM, textTransform: "uppercase", letterSpacing: 1 }}>
        {step}
        {teams > 0 && phase === "lobby" ? ` · ${teams} time${teams > 1 ? "s" : ""}` : ""}
      </span>
    </header>
  );
}

/* ─────────────────────────── LOBBY ─────────────────────────── */

function Lobby({ state, setState }: { state: DraftState; setState: (s: DraftState) => void }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const taken = useMemo(() => new Set(state.teams.map((t) => t.code)), [state.teams]);

  function join() {
    if (!name.trim() || !code) return;
    setState(addTeam(state, name, code));
    setName("");
    setCode(null);
  }

  const canJoin = name.trim().length > 0 && code != null && !taken.has(code);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 340px", gap: 22, alignItems: "start" }}>
      {/* picker */}
      <section style={panel}>
        <Eyebrow>Escolha seu país — quem pegar primeiro, fica com ele</Eyebrow>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px,1fr))", gap: 8, marginTop: 14 }}>
          {COUNTRIES.map((c) => {
            const isTaken = taken.has(c);
            const owner = state.teams.find((t) => t.code === c)?.owner;
            const selected = code === c;
            return (
              <button
                key={c}
                disabled={isTaken}
                onClick={() => setCode(selected ? null : c)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  padding: "9px 11px",
                  borderRadius: 10,
                  textAlign: "left",
                  cursor: isTaken ? "not-allowed" : "pointer",
                  border: `1px solid ${selected ? LIME : LINE}`,
                  background: selected ? "rgba(200,255,45,0.12)" : isTaken ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.03)",
                  color: isTaken ? DIM : INK,
                  opacity: isTaken ? 0.55 : 1,
                  transition: "border-color .12s, background .12s",
                }}
              >
                <FlagIcon code={c} size={16} />
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {teamNamePt(c, c)}
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: DIM }}>{isTaken ? `de ${owner}` : c}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* join + roster */}
      <aside style={{ display: "grid", gap: 16 }}>
        <section style={panel}>
          <Eyebrow>Entrar no jogo</Eyebrow>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && join()}
            placeholder="Seu nome / nick"
            maxLength={20}
            style={{
              width: "100%",
              marginTop: 12,
              padding: "11px 12px",
              borderRadius: 10,
              border: `1px solid ${LINE}`,
              background: "rgba(0,0,0,0.25)",
              color: INK,
              fontSize: 15,
              outline: "none",
            }}
          />
          <div style={{ marginTop: 10, minHeight: 22, fontSize: 12, color: code ? INK : DIM, display: "flex", alignItems: "center", gap: 7 }}>
            {code ? (<><FlagIcon code={code} size={14} /> {teamNamePt(code, code)}</>) : "Selecione um país ao lado"}
          </div>
          <button onClick={join} disabled={!canJoin} style={{ ...primaryBtn, marginTop: 8, opacity: canJoin ? 1 : 0.4, cursor: canJoin ? "pointer" : "not-allowed" }}>
            Entrar como time
          </button>
        </section>

        <section style={panel}>
          <Eyebrow>Times na sala · {state.teams.length}</Eyebrow>
          <div style={{ display: "grid", gap: 7, marginTop: 12 }}>
            {state.teams.length === 0 && <span style={{ fontSize: 13, color: DIM }}>Ninguém entrou ainda.</span>}
            {state.teams.map((t, i) => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 14 }}>
                <span style={{ fontFamily: MONO, fontSize: 11, color: DIM, width: 16 }}>{i + 1}</span>
                <FlagIcon code={t.code} size={15} />
                <span style={{ flex: 1, fontWeight: 600 }}>{t.owner}</span>
                <button onClick={() => setState(removeTeam(state, t.id))} style={ghostX} aria-label="remover">×</button>
              </div>
            ))}
          </div>
          <button onClick={() => setState(addBots(state, 8))} disabled={state.teams.length >= 8} style={{ ...primaryBtn, marginTop: 10, background: "transparent", color: LIME, border: `1px solid ${LIME}`, opacity: state.teams.length >= 8 ? 0.4 : 1, cursor: state.teams.length >= 8 ? "not-allowed" : "pointer" }}>
            🤖 Encher com bots (até 8)
          </button>
          <button
            onClick={() => setState(startDraft(state))}
            disabled={state.teams.length < 2}
            style={{ ...primaryBtn, marginTop: 10, opacity: state.teams.length < 2 ? 0.4 : 1, cursor: state.teams.length < 2 ? "not-allowed" : "pointer" }}
          >
            Iniciar draft →
          </button>
          <p style={{ fontSize: 11, color: DIM, margin: "8px 2px 0", lineHeight: 1.5 }}>
            Precisa de ao menos 2 times. Ao iniciar, a ordem do draft e a ordem das categorias são sorteadas.
          </p>
        </section>

        <section style={panel}>
          <Eyebrow>Atalho de teste</Eyebrow>
          <button onClick={() => setState({ ...state, phase: "groups", field: fillTo48([]) })} style={{ ...primaryBtn, marginTop: 12 }}>
            ⚡ Simular Copa completa (48 · grupos → mata-mata)
          </button>
          <button onClick={() => setState(mockTournament(state))} style={{ ...primaryBtn, marginTop: 8, background: "transparent", color: LIME, border: `1px solid ${LIME}` }}>
            ⚡ Só o mata-mata com 32 (mock)
          </button>
          <p style={{ fontSize: 11, color: DIM, margin: "8px 2px 0", lineHeight: 1.5 }}>
            Pula o lobby/draft: a Copa completa monta 48 times em 12 grupos; o atalho
            de mata-mata cria um chaveamento direto de 32.
          </p>
        </section>
      </aside>
    </div>
  );
}

/* ─────────────────────────── DRAFT ─────────────────────────── */

function Draft({ state, setState }: { state: DraftState; setState: (s: DraftState) => void }) {
  const cat = currentCat(state)!;
  const onClock = onClockTeamId(state);
  const onClockTeam = state.teams.find((t) => t.id === onClock);
  const pool = useMemo(() => [...availableForCurrent(state)].sort((a, b) => b.rating - a.rating), [state]);

  const [auto, setAuto] = useState(false);
  const [draftSpeed, setDraftSpeed] = useState(2);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => setState(autoPickWeighted(stateRef.current)), 700 / draftSpeed);
    return () => clearInterval(id);
  }, [auto, draftSpeed, setState]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* draft order + category order */}
      <section style={{ ...panel, display: "flex", gap: 22, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <Eyebrow>Categorias</Eyebrow>
          <div style={{ display: "flex", gap: 6, marginTop: 9, flexWrap: "wrap" }}>
            {state.catOrder.map((c, i) => {
              const done = i < state.catIdx;
              const active = i === state.catIdx;
              return (
                <span key={c} style={{ fontFamily: MONO, fontSize: 11, padding: "4px 9px", borderRadius: 999, border: `1px solid ${active ? CAT_COLOR[c] : LINE}`, color: active ? "#0a120d" : done ? DIM : INK, background: active ? CAT_COLOR[c] : "transparent", fontWeight: active ? 800 : 500, textDecoration: done ? "line-through" : "none" }}>
                  {CAT_ABBR[c]}
                </span>
              );
            })}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <Eyebrow>Ordem do draft</Eyebrow>
          <div style={{ display: "flex", gap: 6, marginTop: 9, flexWrap: "wrap" }}>
            {state.order.map((id, i) => {
              const t = state.teams.find((x) => x.id === id)!;
              const isOn = id === onClock;
              return (
                <span key={id} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, padding: "4px 9px", borderRadius: 999, border: `1px solid ${isOn ? LIME : LINE}`, background: isOn ? "rgba(200,255,45,0.14)" : "transparent" }}>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: DIM }}>#{i + 1}</span>
                  <FlagIcon code={t.code} size={12} />
                  <span style={{ fontWeight: isOn ? 700 : 500 }}>{t.owner}</span>
                </span>
              );
            })}
          </div>
        </div>
      </section>

      {/* on the clock */}
      {onClockTeam && (
        <section style={{ ...panel, borderColor: CAT_COLOR[cat], display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <FlagIcon code={onClockTeam.code} size={26} />
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ fontSize: 12, color: DIM, fontFamily: MONO, textTransform: "uppercase", letterSpacing: 1 }}>
              Na vez · #{pickNumber(state, onClockTeam.id)}
            </div>
            <div style={{ fontFamily: DISP, fontSize: 22, fontWeight: 800 }}>
              {onClockTeam.owner} <span style={{ color: DIM, fontWeight: 500, fontSize: 15 }}>escolhe um</span>{" "}
              <span style={{ color: CAT_COLOR[cat] }}>{cat}</span>
            </div>
          </div>
          <button onClick={() => setAuto((a) => !a)} style={{ ...smallBtn, borderColor: auto ? LIME : LINE, color: auto ? "#0a120d" : INK, background: auto ? LIME : "rgba(255,255,255,0.04)", fontWeight: 800 }}>
            {auto ? "⏸ Pausar draft" : "▶ Simular draft"}
          </button>
          <div style={{ display: "flex", gap: 4 }}>
            {[1, 2, 4].map((s) => (
              <button key={s} onClick={() => setDraftSpeed(s)} style={{ ...smallBtn, padding: "8px 10px", borderColor: draftSpeed === s ? LIME : LINE, color: draftSpeed === s ? LIME : DIM }}>{s}×</button>
            ))}
          </div>
          <button onClick={() => setState(autoPick(state))} style={smallBtn}>Auto 1</button>
          <button onClick={() => setState(skip(state))} disabled={state.queue.length < 2} style={{ ...smallBtn, opacity: state.queue.length < 2 ? 0.4 : 1, cursor: state.queue.length < 2 ? "not-allowed" : "pointer" }}>
            Passar ↓
          </button>
        </section>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 320px", gap: 16, alignItems: "start" }}>
        {/* player pool */}
        <section style={panel}>
          <Eyebrow>Disponíveis · {cat} ({pool.length})</Eyebrow>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px,1fr))", gap: 8, marginTop: 12 }}>
            {pool.map((p) => (
              <button key={p.id} onClick={() => setState(pick(state, p.id))} style={playerCard}>
                <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</span>
                  <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 800, color: CAT_COLOR[cat] }}>{p.rating}</span>
                </span>
                <span style={{ fontSize: 11, color: DIM, marginTop: 3 }}>{p.club}</span>
              </button>
            ))}
          </div>
        </section>

        {/* teams board + log */}
        <aside style={{ display: "grid", gap: 16 }}>
          <section style={panel}>
            <Eyebrow>Elencos</Eyebrow>
            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              {state.teams.map((t) => (
                <RosterRow key={t.id} team={t} on={t.id === onClock} />
              ))}
            </div>
          </section>
          <section style={panel}>
            <Eyebrow>Histórico</Eyebrow>
            <div style={{ display: "grid", gap: 5, marginTop: 10, maxHeight: 220, overflowY: "auto" }}>
              {state.log.map((l, i) => (
                <div key={i} style={{ fontSize: 11.5, color: i === 0 ? INK : DIM, fontFamily: MONO, lineHeight: 1.45 }}>{l}</div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function RosterRow({ team, on }: { team: Team; on: boolean }) {
  return (
    <div style={{ border: `1px solid ${on ? LIME : LINE}`, borderRadius: 10, padding: "9px 11px", background: on ? "rgba(200,255,45,0.06)" : "transparent" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <FlagIcon code={team.code} size={14} />
        <span style={{ fontWeight: 700, fontSize: 13, flex: 1 }}>{team.owner}</span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: DIM }}>{squadCount(team)}/{SQUAD_SIZE}</span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 7 }}>
        {CATS.flatMap((c) =>
          team.roster[c].map((p) => (
            <span key={p.id} style={{ fontSize: 10.5, fontFamily: MONO, padding: "2px 6px", borderRadius: 6, background: "rgba(255,255,255,0.04)", color: CAT_COLOR[c], border: `1px solid ${CAT_COLOR[c]}33` }} title={`${p.name} · ${c}`}>
              {p.name.split(" ")[0]}
            </span>
          )),
        )}
        {Array.from({ length: SQUAD_SIZE - squadCount(team) }).map((_, i) => (
          <span key={`e${i}`} style={{ fontSize: 10.5, fontFamily: MONO, padding: "2px 6px", borderRadius: 6, border: `1px dashed ${LINE}`, color: DIM }}>—</span>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────── DONE ─────────────────────────── */

function Done({ state, setState }: { state: DraftState; setState: (s: DraftState) => void }) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section style={{ ...panel, textAlign: "center", padding: "26px 20px" }}>
        <div style={{ fontFamily: DISP, fontSize: 26, fontWeight: 800 }}>Draft completo 🎉</div>
        <div style={{ fontSize: 13, color: DIM, marginTop: 6 }}>
          Todos os {state.teams.length} times montaram seus elencos.
          {state.teams.length < 48 ? ` Completamos até 48 com times mock pra fase de grupos.` : ""}
        </div>
        <button onClick={() => setState(goToGroups(state))} style={{ ...primaryBtn, width: "auto", marginTop: 14, padding: "11px 22px" }}>
          Ir para a fase de grupos (48 times) →
        </button>
      </section>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px,1fr))", gap: 14 }}>
        {state.teams.map((t, i) => (
          <section key={t.id} style={panel}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
              <span style={{ fontFamily: MONO, fontSize: 11, color: DIM }}>#{i + 1}</span>
              <FlagIcon code={t.code} size={18} />
              <span style={{ fontFamily: DISP, fontSize: 17, fontWeight: 800, flex: 1 }}>{t.owner}</span>
            </div>
            {CATS.map((c) => (
              <div key={c} style={{ display: "flex", gap: 8, padding: "4px 0", borderTop: `1px solid ${LINE}` }}>
                <span style={{ fontFamily: MONO, fontSize: 10, color: CAT_COLOR[c], width: 30, paddingTop: 2 }}>{CAT_ABBR[c]}</span>
                <span style={{ flex: 1, fontSize: 13 }}>
                  {t.roster[c].map((p) => p.name).join(", ") || <span style={{ color: DIM }}>—</span>}
                </span>
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────── bits ─────────────────────────── */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: MONO, fontSize: 11, color: DIM, textTransform: "uppercase", letterSpacing: 1 }}>{children}</div>;
}

const panel: React.CSSProperties = {
  background: CARD,
  border: `1px solid ${LINE}`,
  borderRadius: 16,
  padding: 18,
};

const primaryBtn: React.CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  borderRadius: 10,
  border: "none",
  background: LIME,
  color: "#0a120d",
  fontWeight: 800,
  fontSize: 14,
  fontFamily: DISP,
};

const smallBtn: React.CSSProperties = {
  padding: "8px 13px",
  borderRadius: 9,
  border: `1px solid ${LINE}`,
  background: "rgba(255,255,255,0.04)",
  color: INK,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const playerCard: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  textAlign: "left",
  padding: "10px 12px",
  borderRadius: 11,
  border: `1px solid ${LINE}`,
  background: "rgba(255,255,255,0.03)",
  color: INK,
  cursor: "pointer",
};

const ghostX: React.CSSProperties = {
  border: "none",
  background: "transparent",
  color: DIM,
  fontSize: 18,
  lineHeight: 1,
  cursor: "pointer",
  padding: "0 4px",
};
