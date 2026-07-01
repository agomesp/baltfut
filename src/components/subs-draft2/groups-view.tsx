"use client";

// Subs group stage — 12 groups of 4 (48 teams) + live match simulation.
// A "matchday" is structurally a bracket "round": its 24 matches play CONCURRENTLY
// over one A0 wall-clock minute; goals/cards/injuries reveal as the clock crosses
// them, the 12 standings tables update as each matchday finishes, and after 3
// matchdays the top 2 of each group + the 8 best thirds (32) advance to the
// knockout. All transitions go through the pure immutable helpers in groups.ts.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlagIcon } from "@/components/live/bf-ui";
import PitchView from "@/components/subs-draft2/pitch-view";
import LineupEditor from "@/components/subs-draft/lineup-editor";
import { subscribeMetronome } from "@/lib/subs-draft/sim-metronome";
import { randInt32 } from "@/lib/subs-draft/prng";
import { SECS_PER_MATCH } from "@/lib/subs-draft/sim-timing";
import type { BroadcastState } from "@/lib/subs-draft/watch-sync";
import type { Team } from "@/lib/subs-draft/engine";
import {
  autoLineup,
  DEFAULT_FORMATION,
  repairLineup,
  type Lineup,
  type StatusMap,
} from "@/lib/subs-draft/squad";
import {
  advanceStatus,
  applyMatchEvents,
  simulateMatchOnPitch,
  FULL_TIME,
  type MatchEvent,
  type MatchResult,
} from "@/lib/subs-draft/tournament";
import {
  bestThirds,
  drawGroups,
  finishMatchday,
  groupMatchSeed,
  MATCHDAY_NAMES,
  playMatchday,
  qualified32,
  standings,
  type Group,
  type GroupMatch,
  type GroupStage,
  type TableRow,
} from "@/lib/subs-draft/groups";

const LIME = "#c8ff2d";
const AMBER = "#f2a93b";
const INK = "#e7f0e9";
const DIM = "#7e8f84";
const LINE = "rgba(200,255,45,0.14)";
const DISP = "var(--font-bric, system-ui)";
const MONO = "var(--font-jb, ui-monospace)";
const TICK_MS = 100;
const MIN_PER_MS = FULL_TIME / (SECS_PER_MATCH * 1000);
const DEFAULT_CUP_SEED = 2026;

type ClockAnchor = { atMs: number; baseMin: number; speed: number };
const minuteFrom = (a: ClockAnchor, nowMs: number): number =>
  Math.max(0, Math.min(FULL_TIME, a.baseMin + (nowMs - a.atMs) * MIN_PER_MS * a.speed));

export default function GroupsView({ teams, onAdvance, onBroadcast }: { teams: Team[]; onAdvance: (qualified: string[]) => void; onBroadcast?: (s: BroadcastState) => void }) {
  const byId = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const ids = useMemo(() => teams.map((t) => t.id), [teams]);

  const [stage, setStageState] = useState<GroupStage>(() => drawGroups(ids, DEFAULT_CUP_SEED));
  const [mdIdx, setMdIdx] = useState(-1); // -1 = draw reveal (not started)
  const [clock, setClock] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [feed, setFeed] = useState<string[]>(["Sorteio pronto — 12 grupos, 48 times. Aperte ▶ para começar."]);
  const [done, setDone] = useState(false);
  const [spotlight, setSpotlight] = useState<string | null>(null);
  const [lineups, setLineupsState] = useState<Record<string, Lineup>>({});
  const [status, setStatusState] = useState<StatusMap>({});
  const [editTeam, setEditTeam] = useState<string | null>(null);
  const [showSquads, setShowSquads] = useState(false);
  const [pauseBetween, setPauseBetween] = useState(false);
  const [awaitingNext, setAwaitingNext] = useState(false);

  const stageRef = useRef<GroupStage>(stage);
  const lineupsRef = useRef<Record<string, Lineup>>({});
  const statusRef = useRef<StatusMap>({});
  const mdRef = useRef(-1);
  const clockRef = useRef(0);
  const speedRef = useRef(1);
  const anchorRef = useRef<ClockAnchor | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextMdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { speedRef.current = speed; }, [speed]);

  const setStage = useCallback((s: GroupStage) => { stageRef.current = s; setStageState(s); }, []);
  const setLineups = useCallback((l: Record<string, Lineup>) => { lineupsRef.current = l; setLineupsState(l); }, []);
  const setStatus = useCallback((s: StatusMap) => { statusRef.current = s; setStatusState(s); }, []);

  const nick = useCallback((id: string | null) => (id ? byId.get(id)?.owner.replace(" 🤖", "") ?? "?" : "?"), [byId]);
  const code = useCallback((id: string | null) => (id ? byId.get(id)?.code ?? "" : ""), [byId]);

  // Resolve a match's two starting XIs and simulate it — DRAWS allowed (groups).
  const simById = useCallback(
    (homeId: string, awayId: string, seed: number): MatchResult => {
      const home = byId.get(homeId)!;
      const away = byId.get(awayId)!;
      const hl = lineupsRef.current[homeId] ?? autoLineup(home, DEFAULT_FORMATION, statusRef.current);
      const al = lineupsRef.current[awayId] ?? autoLineup(away, DEFAULT_FORMATION, statusRef.current);
      return simulateMatchOnPitch(home, away, hl, al, seed, { allowDraw: true });
    },
    [byId],
  );
  const simMatch = useCallback((m: GroupMatch) => simById(m.homeId, m.awayId, groupMatchSeed(stageRef.current.seed, m.group, m.matchday, m.slot)), [simById]);

  const ensureLineups = useCallback(() => {
    const next = { ...lineupsRef.current };
    for (const id of ids) {
      const t = byId.get(id);
      if (t) next[id] = repairLineup(t, next[id], statusRef.current);
    }
    setLineups(next);
  }, [byId, ids, setLineups]);

  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    if (nextMdTimer.current) clearTimeout(nextMdTimer.current);
    nextMdTimer.current = null;
  }, []);

  const startMatchday = useCallback(
    (idx: number, from: GroupStage) => {
      ensureLineups();
      const played = playMatchday(from, idx, simMatch);
      mdRef.current = idx;
      clockRef.current = 0;
      anchorRef.current = null;
      setStage(played);
      setMdIdx(idx);
      setClock(0);
      setAwaitingNext(false);
      setSpotlight(played.groups[0].matchdays[idx][0]?.id ?? null);
      setFeed((f) => [`▶ ${MATCHDAY_NAMES[idx]} — 24 jogos ao vivo`, ...f].slice(0, 80));
      setPlaying(true);
    },
    [ensureLineups, setStage, simMatch],
  );

  const finalizeMatchday = useCallback(() => {
    stop();
    const md = mdRef.current;
    const doneStage = finishMatchday(stageRef.current, md);
    setStage(doneStage);
    // cards/injuries carry to the next matchday
    const events = doneStage.groups.flatMap((g) => g.matchdays[md].flatMap((m) => m.result?.events ?? []));
    setStatus(applyMatchEvents(advanceStatus(statusRef.current), events));

    if (md >= 2) {
      setPlaying(false);
      setDone(true);
      setFeed((f) => ["🏁 Fase de grupos encerrada — 32 classificados!", ...f].slice(0, 80));
    } else if (pauseBetween) {
      setPlaying(false);
      setAwaitingNext(true);
      setFeed((f) => [`✅ ${MATCHDAY_NAMES[md]} encerrada — ajuste as escalações e siga`, ...f].slice(0, 80));
    } else {
      setFeed((f) => [`✅ ${MATCHDAY_NAMES[md]} encerrada`, ...f].slice(0, 80));
      nextMdTimer.current = setTimeout(() => startMatchday(md + 1, doneStage), 1300);
    }
  }, [pauseBetween, setStage, setStatus, startMatchday, stop]);

  useEffect(() => {
    if (!playing) return;
    anchorRef.current = { atMs: performance.now(), baseMin: clockRef.current, speed: speedRef.current };
    const tick = () => {
      const a = anchorRef.current;
      if (!a) return;
      const prev = clockRef.current;
      const next = minuteFrom(a, performance.now());
      if (next <= prev) return;
      clockRef.current = next;
      if (next - prev > 30) {
        setFeed((f) => ["⏩ recuperando a transmissão…", ...f].slice(0, 80));
      } else {
        const shouts: string[] = [];
        for (const g of stageRef.current.groups) {
          for (const m of g.matchdays[mdRef.current] ?? []) {
            if (m.status !== "live" || !m.result) continue;
            for (const e of m.result.events) {
              if (e.minute > prev && e.minute <= next) shouts.push(describe(e, m, code));
            }
          }
        }
        if (shouts.length) setFeed((f) => [...shouts.reverse(), ...f].slice(0, 80));
      }
      setClock(next);
      if (next >= FULL_TIME) finalizeMatchday();
    };
    timer.current = setInterval(tick, TICK_MS);
    const unsubMetro = subscribeMetronome(tick);
    return () => {
      if (timer.current) clearInterval(timer.current);
      unsubMetro();
    };
  }, [playing, mdIdx, finalizeMatchday, code]);

  useEffect(() => {
    if (!playing) return;
    anchorRef.current = { atMs: performance.now(), baseMin: clockRef.current, speed };
  }, [speed, playing]);

  useEffect(() => () => stop(), [stop]);

  // Watch-together: broadcast a tiny snapshot on every transition (the viewer
  // re-derives the whole match from seed + the shared clock). kickoffEpochMs
  // converts the A0 local performance.now() anchor to a shared Date.now() epoch.
  useEffect(() => {
    if (!onBroadcast) return;
    const a = anchorRef.current;
    onBroadcast({
      v: 1, phase: "groups", seed: stage.seed, stageIdx: mdIdx,
      kickoffEpochMs: a ? Date.now() - (performance.now() - a.atMs) : Date.now(),
      baseMin: a && playing ? a.baseMin : clockRef.current,
      speed, playing, spotlight, done, teamIds: null,
    });
  }, [onBroadcast, stage.seed, mdIdx, playing, speed, spotlight, done]);

  const begin = () => (mdRef.current < 0 ? startMatchday(0, stageRef.current) : setPlaying((p) => !p));

  function simulateAll() {
    stop();
    setPlaying(false);
    anchorRef.current = null;
    let s = stageRef.current;
    let st = statusRef.current;
    let lu = { ...lineupsRef.current };
    for (let md = 0; md < 3; md++) {
      for (const id of ids) {
        const t = byId.get(id);
        if (t) lu[id] = repairLineup(t, lu[id], st);
      }
      lineupsRef.current = lu;
      statusRef.current = st;
      s = finishMatchday(playMatchday(s, md, simMatch), md);
      st = applyMatchEvents(advanceStatus(st), s.groups.flatMap((g) => g.matchdays[md].flatMap((m) => m.result?.events ?? [])));
      lu = { ...lu };
    }
    mdRef.current = 2;
    clockRef.current = FULL_TIME;
    setStage(s);
    setLineups(lu);
    setStatus(st);
    setMdIdx(2);
    setClock(FULL_TIME);
    setDone(true);
    setAwaitingNext(false);
    setFeed((f) => ["🏁 Fase de grupos simulada — 32 classificados!", ...f].slice(0, 80));
  }

  const reseed = useCallback(
    (seed: number, msg: string) => {
      stop();
      const fresh = drawGroups(ids, seed);
      mdRef.current = -1;
      clockRef.current = 0;
      anchorRef.current = null;
      setStage(fresh);
      setLineups({});
      setStatus({});
      setMdIdx(-1);
      setClock(0);
      setPlaying(false);
      setAwaitingNext(false);
      setDone(false);
      setSpotlight(null);
      setFeed([msg]);
    },
    [ids, setLineups, setStage, setStatus, stop],
  );
  const restart = () => reseed(stageRef.current.seed, "Fase de grupos reiniciada. Aperte ▶.");
  const newCup = () => reseed(randInt32(), "🎲 Nova Copa sorteada — 12 grupos reembaralhados. Aperte ▶.");

  const openEditor = (id: string) => {
    if (!lineupsRef.current[id]) {
      const t = byId.get(id);
      if (t) setLineups({ ...lineupsRef.current, [id]: autoLineup(t, DEFAULT_FORMATION, statusRef.current) });
    }
    setEditTeam(id);
  };

  const tables = useMemo(() => stage.groups.map((g) => standings(g, stage.seed)), [stage]);
  const thirdsIn = useMemo(() => new Set(bestThirds(stage).map((r) => r.teamId)), [stage]);

  const spotMatch = useMemo(() => {
    if (mdIdx < 0) return null;
    for (const g of stage.groups) {
      const m = (g.matchdays[mdIdx] ?? []).find((x) => x.id === spotlight && x.status === "live" && x.result);
      if (m) return m;
    }
    return null;
  }, [stage, mdIdx, spotlight]);

  const liveScore = useCallback(
    (m: GroupMatch, side: "home" | "away"): number | null => {
      if (!m.result) return null;
      if (m.status === "done") return side === "home" ? m.result.homeGoals : m.result.awayGoals;
      const id = side === "home" ? m.homeId : m.awayId;
      return m.result.events.filter((e) => e.type === "goal" && e.teamId === id && e.minute <= clock).length;
    },
    [clock],
  );

  const lineupFor = (id: string | null): Lineup | null => {
    if (!id) return null;
    const t = byId.get(id);
    if (!t) return null;
    return lineups[id] ?? autoLineup(t, DEFAULT_FORMATION, status);
  };

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* control bar */}
      <section style={{ ...panel, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button onClick={begin} disabled={done || awaitingNext} style={{ ...primaryBtn, opacity: done || awaitingNext ? 0.4 : 1, cursor: done || awaitingNext ? "not-allowed" : "pointer" }}>
          {mdIdx < 0 ? "▶ Iniciar fase de grupos" : playing ? "⏸ Pausar" : "▶ Continuar"}
        </button>
        {awaitingNext && (
          <button onClick={() => startMatchday(mdRef.current + 1, stageRef.current)} style={{ ...primaryBtn, background: "#fff" }}>
            Próxima rodada ▶
          </button>
        )}
        <div style={{ display: "flex", gap: 6 }}>
          {[1, 4, 16].map((s) => (
            <button key={s} onClick={() => setSpeed(s)} style={{ ...chip, borderColor: speed === s ? LIME : LINE, color: speed === s ? "#0a120d" : INK, background: speed === s ? LIME : "transparent", fontWeight: speed === s ? 800 : 500 }}>{s}×</button>
          ))}
        </div>
        <button onClick={simulateAll} disabled={done} style={{ ...smallBtn, opacity: done ? 0.4 : 1 }}>⏩ Simular tudo</button>
        <button onClick={() => setShowSquads((v) => !v)} style={{ ...smallBtn, borderColor: showSquads ? LIME : LINE }}>⚙ Escalações</button>
        <button onClick={() => setPauseBetween((v) => !v)} title="Pausar entre as rodadas pra ajustar escalações" style={{ ...smallBtn, borderColor: pauseBetween ? LIME : LINE, color: pauseBetween ? LIME : INK }}>
          {pauseBetween ? "⏸ Escalar entre rodadas" : "▷ Auto-avançar"}
        </button>
        <button onClick={restart} style={smallBtn}>↺ Reiniciar</button>
        <button onClick={newCup} style={smallBtn}>🎲 Nova Copa</button>
        <div style={{ flex: 1 }} />
        <div style={{ fontFamily: MONO, fontSize: 13, color: DIM }}>
          {mdIdx >= 0 && !done ? (
            <><span style={{ color: LIME, fontWeight: 800 }}>{MATCHDAY_NAMES[mdIdx]}</span>{playing || clock > 0 ? <span> · {Math.round(clock)}&apos;</span> : null}</>
          ) : null}
        </div>
      </section>

      {showSquads && (
        <section style={panel}>
          <div style={{ fontFamily: MONO, fontSize: 11, color: DIM, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
            Escalações · 48 times <span style={{ color: DIM }}>· clique p/ montar o XI e a formação</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px,1fr))", gap: 7 }}>
            {ids.map((id) => (
              <button key={id} onClick={() => openEditor(id)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 9, border: `1px solid ${LINE}`, background: "rgba(255,255,255,0.03)", color: INK, cursor: "pointer", textAlign: "left" }}>
                <FlagIcon code={code(id)} size={14} />
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nick(id)}</span>
                <span style={{ fontFamily: MONO, fontSize: 10, color: DIM }}>{lineups[id]?.formation ?? DEFAULT_FORMATION}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {done && (
        <section style={{ ...panel, textAlign: "center", padding: 20, border: `1px solid ${LIME}`, background: "rgba(200,255,45,0.07)" }}>
          <div style={{ fontFamily: MONO, fontSize: 12, color: DIM, letterSpacing: 1 }}>FASE DE GRUPOS ENCERRADA</div>
          <div style={{ fontFamily: DISP, fontSize: 24, fontWeight: 800, marginTop: 6 }}>32 classificados 🎉</div>
          <div style={{ fontSize: 12, color: DIM, marginTop: 4 }}>1º e 2º de cada grupo + os 8 melhores 3º colocados.</div>
          <button onClick={() => onAdvance(qualified32(stageRef.current))} style={{ ...primaryBtn, marginTop: 14, padding: "11px 22px" }}>
            Ir para o mata-mata (32) →
          </button>
        </section>
      )}

      {/* spotlight pitch */}
      {spotMatch && lineupFor(spotMatch.homeId) && lineupFor(spotMatch.awayId) && (
        <section style={{ ...panel, padding: 0, overflow: "hidden" }}>
          <div style={{ fontFamily: MONO, fontSize: 11, color: DIM, textTransform: "uppercase", letterSpacing: 1, padding: "12px 14px 0" }}>
            Jogo em destaque · {MATCHDAY_NAMES[mdIdx]} <span style={{ color: DIM }}>(clique num jogo ao vivo pra trocar)</span>
          </div>
          <PitchView
            key={spotMatch.id}
            home={byId.get(spotMatch.homeId)!}
            away={byId.get(spotMatch.awayId)!}
            homeLineup={lineupFor(spotMatch.homeId)!}
            awayLineup={lineupFor(spotMatch.awayId)!}
            homeCode={code(spotMatch.homeId)}
            awayCode={code(spotMatch.awayId)}
            events={spotMatch.result!.events}
            clock={clock}
            playing={playing}
            seed={groupMatchSeed(stage.seed, spotMatch.group, spotMatch.matchday, spotMatch.slot)}
          />
        </section>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 300px", gap: 14, alignItems: "start" }}>
        {/* 12 group tables */}
        <section style={{ ...panel, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px,1fr))", gap: 12 }}>
          {stage.groups.map((g, gi) => (
            <GroupCard
              key={g.name}
              group={g}
              table={tables[gi]}
              mdIdx={mdIdx}
              playing={playing}
              spotlight={spotlight}
              thirdsIn={thirdsIn}
              nick={nick}
              code={code}
              liveScore={liveScore}
              onPick={(id) => setSpotlight(id)}
            />
          ))}
        </section>

        {/* commentary */}
        <aside style={panel}>
          <div style={{ fontFamily: MONO, fontSize: 11, color: DIM, textTransform: "uppercase", letterSpacing: 1 }}>Narração ao vivo</div>
          <div style={{ display: "grid", gap: 5, marginTop: 10, maxHeight: 620, overflowY: "auto" }}>
            {feed.map((l, i) => (<div key={i} style={{ fontSize: 12, color: i === 0 ? INK : DIM, fontFamily: MONO, lineHeight: 1.45 }}>{l}</div>))}
          </div>
        </aside>
      </div>

      {editTeam && lineups[editTeam] && byId.get(editTeam) && (
        <LineupEditor
          team={byId.get(editTeam)!}
          lineup={lineups[editTeam]}
          status={status}
          onChange={(l) => setLineups({ ...lineupsRef.current, [editTeam]: l })}
          onClose={() => setEditTeam(null)}
        />
      )}
    </div>
  );
}

function describe(e: MatchEvent, m: GroupMatch, code: (id: string | null) => string): string {
  if (e.type === "goal") {
    const hg = m.result!.events.filter((x) => x.type === "goal" && x.teamId === m.homeId && x.minute <= e.minute).length;
    const ag = m.result!.events.filter((x) => x.type === "goal" && x.teamId === m.awayId && x.minute <= e.minute).length;
    return `⚽ ${e.minute}' ${e.player} (${code(e.teamId)}) — ${code(m.homeId)} ${hg}×${ag} ${code(m.awayId)}`;
  }
  if (e.type === "yellow") return `🟨 ${e.minute}' ${e.player} (${code(e.teamId)}) — amarelo`;
  if (e.type === "red") return `🟥 ${e.minute}' ${e.player} (${code(e.teamId)}) — VERMELHO, suspenso`;
  const dur = e.out === "cup" ? "fora da copa" : `fora ${e.out} jogo${e.out && e.out > 1 ? "s" : ""}`;
  return `🚑 ${e.minute}' ${e.player} (${code(e.teamId)}) — lesão, ${dur}`;
}

function GroupCard({
  group, table, mdIdx, playing, spotlight, thirdsIn, nick, code, liveScore, onPick,
}: {
  group: Group;
  table: TableRow[];
  mdIdx: number;
  playing: boolean;
  spotlight: string | null;
  thirdsIn: Set<string>;
  nick: (id: string | null) => string;
  code: (id: string | null) => string;
  liveScore: (m: GroupMatch, side: "home" | "away") => number | null;
  onPick: (id: string) => void;
}) {
  const fixtures = mdIdx >= 0 ? group.matchdays[mdIdx] ?? [] : [];
  return (
    <div style={{ border: `1px solid ${LINE}`, borderRadius: 10, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 9px", background: "rgba(200,255,45,0.06)", borderBottom: `1px solid ${LINE}` }}>
        <span style={{ fontFamily: DISP, fontWeight: 800, fontSize: 13 }}>Grupo {group.name}</span>
      </div>
      {/* header */}
      <div style={{ display: "grid", gridTemplateColumns: "16px 1fr 16px 16px 22px", gap: 4, padding: "4px 9px", fontFamily: MONO, fontSize: 8.5, color: DIM, letterSpacing: 0.3 }}>
        <span>#</span><span>TIME</span><span style={{ textAlign: "center" }}>P</span><span style={{ textAlign: "center" }}>SG</span><span style={{ textAlign: "right" }}>PTS</span>
      </div>
      {/* only tint qualification once matches have been played (not on the draw reveal,
          where a lot-ordered 0-0-0 table would read as a spoiler prediction) */}
      {table.map((r, pos) => {
        const played = table.some((x) => x.P > 0);
        const q = !played ? null : pos < 2 ? LIME : pos === 2 && thirdsIn.has(r.teamId) ? AMBER : null;
        return (
          <div key={r.teamId} style={{ display: "grid", gridTemplateColumns: "16px 1fr 16px 16px 22px", gap: 4, alignItems: "center", padding: "3px 9px", borderTop: `1px solid rgba(255,255,255,0.03)`, background: q ? `${q}14` : "transparent" }}>
            <span style={{ fontFamily: MONO, fontSize: 10, color: q ?? DIM, fontWeight: q ? 800 : 500 }}>{pos + 1}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
              <FlagIcon code={code(r.teamId)} size={11} />
              <span style={{ fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: q ?? INK }} title={nick(r.teamId)}>{nick(r.teamId)}</span>
            </span>
            <span style={{ fontFamily: MONO, fontSize: 10, color: DIM, textAlign: "center" }}>{r.P}</span>
            <span style={{ fontFamily: MONO, fontSize: 10, color: DIM, textAlign: "center" }}>{r.GD > 0 ? `+${r.GD}` : r.GD}</span>
            <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 800, textAlign: "right", color: INK }}>{r.Pts}</span>
          </div>
        );
      })}
      {/* current-matchday fixtures (clickable into the spotlight) */}
      {fixtures.length > 0 && (
        <div style={{ borderTop: `1px solid ${LINE}`, padding: "5px 9px", display: "grid", gap: 3 }}>
          {fixtures.map((m) => {
            const isLive = playing && m.status === "live";
            const spot = m.id === spotlight;
            return (
              <div key={m.id} onClick={() => isLive && onPick(m.id)} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, cursor: isLive ? "pointer" : "default", color: isLive ? INK : DIM, fontWeight: spot ? 800 : 500 }}>
                <FlagIcon code={code(m.homeId)} size={9} />
                <span style={{ flex: 1, textAlign: "right", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nick(m.homeId)}</span>
                <span style={{ fontFamily: MONO, fontWeight: 700, color: spot ? LIME : INK }}>{liveScore(m, "home") ?? "-"}×{liveScore(m, "away") ?? "-"}</span>
                <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nick(m.awayId)}</span>
                <FlagIcon code={code(m.awayId)} size={9} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const panel: React.CSSProperties = { background: "transparent", border: `1px solid ${LINE}`, borderRadius: 16, padding: 16 };
const primaryBtn: React.CSSProperties = { padding: "9px 16px", borderRadius: 10, border: "none", background: LIME, color: "#0a120d", fontWeight: 800, fontSize: 14, fontFamily: DISP, cursor: "pointer" };
const smallBtn: React.CSSProperties = { padding: "8px 12px", borderRadius: 9, border: `1px solid ${LINE}`, background: "rgba(255,255,255,0.04)", color: INK, fontSize: 13, fontWeight: 600, cursor: "pointer" };
const chip: React.CSSProperties = { padding: "7px 11px", borderRadius: 999, border: `1px solid ${LINE}`, background: "transparent", color: INK, fontFamily: MONO, fontSize: 12, cursor: "pointer" };
