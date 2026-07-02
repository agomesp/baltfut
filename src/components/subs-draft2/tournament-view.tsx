"use client";

// Subs knockout — the 32-team bracket + live match simulation (local-only spike).
// Each round's matches play CONCURRENTLY over one minute (at 1×): the clock runs
// 0'→90', goals/cards/injuries reveal as it crosses them, a shared commentary feed
// streams the action, and winners advance — round by round — to the champion.
//
// Every team fields a STARTING XI from a formation (editable per team); suspensions
// (2 yellows / red) and injuries carry across rounds and force lineup changes.
//
// All bracket transitions go through the pure immutable helpers in tournament.ts;
// the component only ever reassigns refs to fresh brackets, never mutates one.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlagIcon } from "@/components/live/bf-ui";
import PitchView from "@/components/subs-draft2/pitch-view";
import LineupEditor from "@/components/subs-draft/lineup-editor";
import { subscribeMetronome } from "@/lib/subs-draft/sim-metronome";
import { randInt32 } from "@/lib/subs-draft/prng";
import { SECS_PER_MATCH } from "@/lib/subs-draft/sim-timing";
import { computeChunked, isAbort } from "@/lib/subs-draft/async-sim";
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
  bracketMatchSeed,
  buildBracket,
  championId,
  finishRound,
  FULL_TIME,
  playRound,
  ROUND_NAMES,
  simulateMatchOnPitch,
  type Bracket,
  type BracketMatch,
  type MatchEvent,
  type MatchResult,
} from "@/lib/subs-draft/tournament";

const LIME = "#c8ff2d";
const INK = "#e7f0e9";
const DIM = "#7e8f84";
const LINE = "rgba(200,255,45,0.14)";
const DISP = "var(--font-bric, system-ui)";
const MONO = "var(--font-jb, ui-monospace)";
const TICK_MS = 100;
const MIN_PER_MS = FULL_TIME / (SECS_PER_MATCH * 1000);
const DEFAULT_BRACKET_SEED = 2026; // fixed → reproducible (replay + watch-together); Reiniciar reseeds

/** A0.2: the displayed match minute, derived from a WALL-CLOCK anchor rather than
 * accumulated ticks — so a hidden/throttled tab doesn't fall behind and the clock
 * catches up correctly on resume. performance.now() only sets how far the reveal
 * is; it never touches the seeded sim. */
type ClockAnchor = { atMs: number; baseMin: number; speed: number };
const minuteFrom = (a: ClockAnchor, nowMs: number): number =>
  Math.max(0, Math.min(FULL_TIME, a.baseMin + (nowMs - a.atMs) * MIN_PER_MS * a.speed));

export default function TournamentView({ teams, onBroadcast }: { teams: Team[]; onBroadcast?: (s: BroadcastState) => void }) {
  const byId = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const ids = useMemo(() => teams.map((t) => t.id), [teams]);

  const [bracketSeed, setBracketSeedState] = useState(DEFAULT_BRACKET_SEED);
  const [bracket, setBracketState] = useState<Bracket>(() => buildBracket(ids, DEFAULT_BRACKET_SEED));
  const [roundIdx, setRoundIdx] = useState(-1);
  const [clock, setClock] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [feed, setFeed] = useState<string[]>(["Mata-mata pronto — 32 times. Aperte ▶ para começar."]);
  const [champion, setChampion] = useState<string | null>(null);
  const [spotlight, setSpotlight] = useState<string | null>(null);
  const [lineups, setLineupsState] = useState<Record<string, Lineup>>({});
  const [status, setStatusState] = useState<StatusMap>({});
  const [editTeam, setEditTeam] = useState<string | null>(null);
  const [showSquads, setShowSquads] = useState(false);
  const [pauseBetween, setPauseBetween] = useState(false);
  const [awaitingNext, setAwaitingNext] = useState(false);
  const [preparing, setPreparing] = useState(false); // computing a round's results (time-sliced)

  const bracketRef = useRef<Bracket>(bracket);
  const bracketSeedRef = useRef(DEFAULT_BRACKET_SEED);
  const lineupsRef = useRef<Record<string, Lineup>>({});
  const statusRef = useRef<StatusMap>({});
  const roundRef = useRef(-1);
  const clockRef = useRef(0);
  const speedRef = useRef(1);
  const anchorRef = useRef<ClockAnchor | null>(null); // A0.2 wall-clock anchor for the match minute
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextRoundTimer = useRef<ReturnType<typeof setTimeout> | null>(null); // inter-round auto-advance
  const prepAbortRef = useRef<AbortController | null>(null); // cancels an in-flight round precompute
  useEffect(() => { speedRef.current = speed; }, [speed]);

  const setBracket = useCallback((b: Bracket) => { bracketRef.current = b; setBracketState(b); }, []);
  const setBracketSeed = useCallback((s: number) => { bracketSeedRef.current = s; setBracketSeedState(s); }, []);
  const setLineups = useCallback((l: Record<string, Lineup>) => { lineupsRef.current = l; setLineupsState(l); }, []);
  const setStatus = useCallback((s: StatusMap) => { statusRef.current = s; setStatusState(s); }, []);

  const nick = useCallback((id: string | null) => (id ? byId.get(id)?.owner.replace(" 🤖", "") ?? "?" : "?"), [byId]);
  const code = useCallback((id: string | null) => (id ? byId.get(id)?.code ?? "" : ""), [byId]);
  // Smooth match progress (0..1) at a given performance.now() — the SAME wall-clock
  // anchor that drives the displayed minute, sampled per render frame so the authoritative
  // spotlight sim steps ~1 tick/frame instead of in the coarse clock's 100 ms bursts.
  const progressAt = useCallback((now: number) => {
    const a = anchorRef.current;
    return a ? Math.max(0, Math.min(1, minuteFrom(a, now) / 90)) : clockRef.current / 90;
  }, []);

  // Resolve a match's two starting XIs and simulate it.
  const simById = useCallback(
    (homeId: string, awayId: string, round: number, slot: number): MatchResult => {
      const home = byId.get(homeId)!;
      const away = byId.get(awayId)!;
      const hl = lineupsRef.current[homeId] ?? autoLineup(home, DEFAULT_FORMATION, statusRef.current);
      const al = lineupsRef.current[awayId] ?? autoLineup(away, DEFAULT_FORMATION, statusRef.current);
      return simulateMatchOnPitch(home, away, hl, al, bracketMatchSeed(bracketSeedRef.current, round, slot));
    },
    [byId],
  );

  // Repair/create lineups for the given teams against the current status (drops
  // suspended/injured players, refills from the bench).
  const ensureLineups = useCallback(
    (teamIds: string[]) => {
      const next = { ...lineupsRef.current };
      for (const id of teamIds) {
        const t = byId.get(id);
        if (t) next[id] = repairLineup(t, next[id], statusRef.current);
      }
      setLineups(next);
    },
    [byId, setLineups],
  );

  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    if (nextRoundTimer.current) clearTimeout(nextRoundTimer.current); // cancel a pending auto-advance
    nextRoundTimer.current = null;
    prepAbortRef.current?.abort(); // cancel any in-flight round precompute
    prepAbortRef.current = null;
  }, []);

  const roundTeamIds = (b: Bracket, idx: number) => b[idx].flatMap((m) => [m.homeId, m.awayId]).filter((x): x is string => x != null);

  // Compute the round's results OFF the blocking path (computeChunked yields between each
  // ~22ms match) so starting a round no longer freezes the tab. playRound stays pure — it
  // just does lookups. Aborts if superseded / the bracket is reset.
  const startRound = useCallback(
    async (idx: number, from: Bracket) => {
      ensureLineups(roundTeamIds(from, idx));
      prepAbortRef.current?.abort();
      const controller = new AbortController();
      prepAbortRef.current = controller;
      setPreparing(true);
      const live = from[idx].filter((m) => m.homeId && m.awayId && !m.result);
      let results;
      try {
        results = await computeChunked(live, (m) => simById(m.homeId!, m.awayId!, idx, m.slot), { signal: controller.signal });
      } catch (e) {
        if (isAbort(e)) return; // superseded or reset
        throw e;
      }
      if (controller.signal.aborted) return;
      const by = new Map(live.map((m, i) => [m.slot, results[i]]));
      const withResults = playRound(from, idx, (_h, _a, _r, slot) => by.get(slot)!);
      setPreparing(false);
      roundRef.current = idx;
      clockRef.current = 0;
      anchorRef.current = null; // drop the previous round's anchor so a still-live tick bails until re-anchored
      setBracket(withResults);
      setRoundIdx(idx);
      setClock(0);
      setAwaitingNext(false);
      setSpotlight(withResults[idx][0]?.id ?? null);
      setFeed((f) => [`▶ ${ROUND_NAMES[idx]} — ${withResults[idx].length} jogo${withResults[idx].length > 1 ? "s" : ""} ao vivo`, ...f].slice(0, 80));
      setPlaying(true);
    },
    [ensureLineups, setBracket, simById],
  );

  const finalize = useCallback(() => {
    stop();
    const r = roundRef.current;
    const live = bracketRef.current[r];
    const done = finishRound(bracketRef.current, r);
    const pens = live
      .filter((m) => m.result?.pens)
      .map((m) => `🥅 pênaltis · ${code(m.homeId)} ${m.result!.pens!.home}×${m.result!.pens!.away} ${code(m.awayId)} → ${code(m.result!.winnerId)} avança`);
    setBracket(done);

    // cards/injuries carry forward
    const events = live.flatMap((m) => m.result?.events ?? []);
    setStatus(applyMatchEvents(advanceStatus(statusRef.current), events));

    if (pens.length) setFeed((f) => [...pens, ...f].slice(0, 80));

    if (r >= done.length - 1) {
      const champ = championId(done);
      setChampion(champ);
      setPlaying(false);
      setFeed((f) => [`🏆 CAMPEÃO: ${nick(champ)} (${code(champ)}) levanta a taça!`, ...f].slice(0, 80));
    } else if (pauseBetween) {
      setPlaying(false);
      setAwaitingNext(true);
      setFeed((f) => [`✅ ${ROUND_NAMES[r]} encerrada — ajuste as escalações e siga`, ...f].slice(0, 80));
    } else {
      setFeed((f) => [`✅ ${ROUND_NAMES[r]} encerrada — vencedores avançam`, ...f].slice(0, 80));
      nextRoundTimer.current = setTimeout(() => startRound(r + 1, done), 1300);
    }
  }, [code, nick, pauseBetween, setBracket, setStatus, startRound, stop]);

  // The match clock — derived from a wall-clock anchor (survives a hidden tab and
  // catches up on resume); reveals events in the (prev, next] window; finalizes at 90'.
  useEffect(() => {
    if (!playing) return;
    anchorRef.current = { atMs: performance.now(), baseMin: clockRef.current, speed: speedRef.current };
    const tick = () => {
      const a = anchorRef.current;
      if (!a) return;
      const prev = clockRef.current;
      const next = minuteFrom(a, performance.now());
      if (next <= prev) return; // no wall time elapsed since last tick
      clockRef.current = next;
      // A huge single-tick jump = a resume from full-window occlusion (the worker
      // escapes throttling but not occlusion). Don't replay the whole window of
      // goals/cards at once — collapse to one line, like the pitch ticker does.
      if (next - prev > 30) {
        setFeed((f) => ["⏩ recuperando a transmissão…", ...f].slice(0, 80));
      } else {
        const shouts: string[] = [];
        for (const m of bracketRef.current[roundRef.current] ?? []) {
          if (m.status !== "live" || !m.result) continue;
          for (const e of m.result.events) {
            if (e.minute > prev && e.minute <= next) shouts.push(describe(e, m, code));
          }
        }
        if (shouts.length) setFeed((f) => [...shouts.reverse(), ...f].slice(0, 80));
      }
      setClock(next);
      if (next >= FULL_TIME) finalize();
    };
    timer.current = setInterval(tick, TICK_MS); // drives when visible (also the no-Worker fallback)
    const unsubMetro = subscribeMetronome(tick); // A0.3: keeps the minute advancing while hidden
    return () => {
      if (timer.current) clearInterval(timer.current);
      unsubMetro();
    };
  }, [playing, roundIdx, finalize, code]);

  // Re-anchor the wall clock when speed changes mid-match so past elapsed keeps its
  // old rate and future elapsed uses the new one (no retroactive jump).
  useEffect(() => {
    if (!playing) return;
    anchorRef.current = { atMs: performance.now(), baseMin: clockRef.current, speed };
  }, [speed, playing]);

  useEffect(() => () => stop(), [stop]);

  // Watch-together: broadcast a snapshot on every transition; the viewer re-derives
  // the whole knockout from bracketSeed + the shared clock.
  useEffect(() => {
    if (!onBroadcast) return;
    const a = anchorRef.current;
    onBroadcast({
      v: 1, phase: "bracket", seed: bracketSeed, stageIdx: roundIdx,
      kickoffEpochMs: a ? Date.now() - (performance.now() - a.atMs) : Date.now(),
      baseMin: a && playing ? a.baseMin : clockRef.current,
      speed, playing, spotlight, done: champion != null, teamIds: ids,
    });
  }, [onBroadcast, ids, bracketSeed, roundIdx, playing, speed, spotlight, champion]);

  const begin = () => (roundRef.current < 0 ? startRound(0, bracketRef.current) : setPlaying((p) => !p));

  function simulateAll() {
    stop();
    setPlaying(false);
    anchorRef.current = null;
    let b = bracketRef.current;
    let st = statusRef.current;
    let lu = { ...lineupsRef.current };
    for (let r = 0; r < b.length; r++) {
      for (const id of roundTeamIds(b, r)) {
        const t = byId.get(id);
        if (t) lu[id] = repairLineup(t, lu[id], st);
      }
      lineupsRef.current = lu;
      statusRef.current = st;
      b = playRound(b, r, simById);
      b = finishRound(b, r);
      st = applyMatchEvents(advanceStatus(st), b[r].flatMap((m) => m.result?.events ?? []));
      lu = { ...lu };
    }
    roundRef.current = b.length - 1;
    clockRef.current = FULL_TIME;
    setBracket(b);
    setLineups(lu);
    setStatus(st);
    setRoundIdx(b.length - 1);
    setClock(FULL_TIME);
    setAwaitingNext(false);
    const champ = championId(b);
    setChampion(champ);
    setFeed((f) => [`🏆 CAMPEÃO: ${nick(champ)} (${code(champ)})!`, "⏩ Torneio simulado de uma vez", ...f].slice(0, 80));
  }

  function restart() {
    stop();
    const seed = randInt32(); // reseed → a fresh reproducible bracket
    setBracketSeed(seed);
    const fresh = buildBracket(ids, seed);
    roundRef.current = -1;
    clockRef.current = 0;
    anchorRef.current = null;
    setBracket(fresh);
    setLineups({});
    setStatus({});
    setRoundIdx(-1);
    setClock(0);
    setPlaying(false);
    setAwaitingNext(false);
    setPreparing(false);
    setChampion(null);
    setFeed(["Mata-mata reembaralhado — 32 times. Aperte ▶."]);
  }
  useEffect(() => () => prepAbortRef.current?.abort(), []); // drop an in-flight precompute on unmount

  const openEditor = (id: string) => {
    if (onBroadcast) return; // transmitting → automatic lineups only (viewers rebuild them)
    if (!lineupsRef.current[id]) {
      const t = byId.get(id);
      if (t) setLineups({ ...lineupsRef.current, [id]: autoLineup(t, DEFAULT_FORMATION, statusRef.current) });
    }
    setEditTeam(id);
  };

  const eliminated = useMemo(() => {
    const s = new Set<string>();
    for (const round of bracket) for (const m of round) {
      if (m.status === "done" && m.result) {
        const loser = m.homeId === m.result.winnerId ? m.awayId : m.homeId;
        if (loser) s.add(loser);
      }
    }
    return s;
  }, [bracket]);
  const alive = ids.filter((id) => !eliminated.has(id));

  const spotMatch =
    roundIdx >= 0 ? (bracket[roundIdx] ?? []).find((m) => m.id === spotlight && m.status === "live" && m.result) ?? null : null;

  const liveScore = (m: BracketMatch, side: "home" | "away"): number | null => {
    if (!m.result) return null;
    if (m.status === "done") return side === "home" ? m.result.homeGoals : m.result.awayGoals;
    const id = side === "home" ? m.homeId : m.awayId;
    return m.result.events.filter((e) => e.type === "goal" && e.teamId === id && e.minute <= clock).length;
  };

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
        <button onClick={begin} disabled={champion != null || awaitingNext || preparing} style={{ ...primaryBtn, opacity: champion || awaitingNext || preparing ? 0.4 : 1, cursor: champion || awaitingNext || preparing ? "not-allowed" : "pointer" }}>
          {preparing ? "⏳ Preparando…" : roundIdx < 0 ? "▶ Iniciar torneio" : playing ? "⏸ Pausar" : "▶ Continuar"}
        </button>
        {awaitingNext && (
          <button onClick={() => startRound(roundRef.current + 1, bracketRef.current)} style={{ ...primaryBtn, background: "#fff" }}>
            Próxima fase ▶
          </button>
        )}
        <div style={{ display: "flex", gap: 6 }}>
          {[1, 4, 16].map((s) => (
            <button key={s} onClick={() => setSpeed(s)} style={{ ...chip, borderColor: speed === s ? LIME : LINE, color: speed === s ? "#0a120d" : INK, background: speed === s ? LIME : "transparent", fontWeight: speed === s ? 800 : 500 }}>{s}×</button>
          ))}
        </div>
        <button onClick={simulateAll} disabled={champion != null} style={{ ...smallBtn, opacity: champion ? 0.4 : 1 }}>⏩ Simular tudo</button>
        <button onClick={() => setShowSquads((v) => !v)} disabled={!!onBroadcast} title={onBroadcast ? "Escalações automáticas durante a transmissão" : undefined} style={{ ...smallBtn, borderColor: showSquads && !onBroadcast ? LIME : LINE, opacity: onBroadcast ? 0.4 : 1, cursor: onBroadcast ? "not-allowed" : "pointer" }}>⚙ Escalações</button>
        <button onClick={() => setPauseBetween((v) => !v)} title="Pausar entre as fases pra ajustar escalações" style={{ ...smallBtn, borderColor: pauseBetween ? LIME : LINE, color: pauseBetween ? LIME : INK }}>
          {pauseBetween ? "⏸ Escalar entre fases" : "▷ Auto-avançar"}
        </button>
        <button onClick={restart} style={smallBtn}>↺ Reiniciar</button>
        <div style={{ flex: 1 }} />
        <div style={{ fontFamily: MONO, fontSize: 13, color: DIM }}>
          {roundIdx >= 0 && !champion ? (
            <><span style={{ color: LIME, fontWeight: 800 }}>{ROUND_NAMES[roundIdx]}</span>{playing || clock > 0 ? <span> · {Math.round(clock)}&apos;</span> : null}</>
          ) : null}
        </div>
      </section>

      {showSquads && (
        <section style={panel}>
          <div style={{ fontFamily: MONO, fontSize: 11, color: DIM, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
            Escalações · {alive.length} times vivos <span style={{ color: DIM }}>· clique p/ montar o XI e a formação</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px,1fr))", gap: 7 }}>
            {alive.map((id) => (
              <button key={id} onClick={() => openEditor(id)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 9, border: `1px solid ${LINE}`, background: "rgba(255,255,255,0.03)", color: INK, cursor: "pointer", textAlign: "left" }}>
                <FlagIcon code={code(id)} size={14} />
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nick(id)}</span>
                <span style={{ fontFamily: MONO, fontSize: 10, color: DIM }}>{lineups[id]?.formation ?? DEFAULT_FORMATION}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {champion && (
        <section style={{ ...panel, textAlign: "center", padding: 20, border: `1px solid ${LIME}`, background: "rgba(200,255,45,0.07)" }}>
          <div style={{ fontFamily: MONO, fontSize: 12, color: DIM, letterSpacing: 1 }}>CAMPEÃO DO MATA-MATA</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 8 }}>
            <FlagIcon code={code(champion)} size={30} />
            <span style={{ fontFamily: DISP, fontSize: 30, fontWeight: 800 }}>{nick(champion)}</span>
            <span style={{ fontSize: 26 }}>🏆</span>
          </div>
        </section>
      )}

      {/* spotlight pitch — the live match in pseudo-3D */}
      {spotMatch && spotMatch.homeId && spotMatch.awayId && lineupFor(spotMatch.homeId) && lineupFor(spotMatch.awayId) && (
        <section style={{ ...panel, padding: 0, overflow: "hidden" }}>
          <div style={{ fontFamily: MONO, fontSize: 11, color: DIM, textTransform: "uppercase", letterSpacing: 1, padding: "12px 14px 0" }}>
            Jogo em destaque · {ROUND_NAMES[roundIdx]} <span style={{ color: DIM }}>(clique num jogo ao vivo pra trocar)</span>
          </div>
          <PitchView
            key={spotMatch.id}
            home={byId.get(spotMatch.homeId)!}
            away={byId.get(spotMatch.awayId)!}
            homeLineup={lineupFor(spotMatch.homeId)!}
            awayLineup={lineupFor(spotMatch.awayId)!}
            homeCode={code(spotMatch.homeId)}
            awayCode={code(spotMatch.awayId)}
            progressAt={progressAt}
            clock={clock}
            playing={playing}
            seed={bracketMatchSeed(bracketSeed, spotMatch.round, spotMatch.slot)}
          />
        </section>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 300px", gap: 14, alignItems: "start" }}>
        {/* bracket */}
        <section style={{ ...panel, overflowX: "auto" }}>
          <div style={{ display: "flex", gap: 10, minWidth: 760 }}>
            {bracket.map((round, r) => (
              <div key={r} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-around", gap: 6, minWidth: 130 }}>
                <div style={{ fontFamily: MONO, fontSize: 10, color: r === roundIdx ? LIME : DIM, textAlign: "center", letterSpacing: 0.5, marginBottom: 2 }}>{ROUND_NAMES[r]}</div>
                {round.map((m) => (
                  <MatchCell key={m.id} m={m} live={r === roundIdx && playing} spot={m.id === spotlight} hs={liveScore(m, "home")} as={liveScore(m, "away")} nick={nick} code={code} onPick={() => m.status === "live" && setSpotlight(m.id)} />
                ))}
              </div>
            ))}
          </div>
        </section>

        {/* commentary */}
        <aside style={panel}>
          <div style={{ fontFamily: MONO, fontSize: 11, color: DIM, textTransform: "uppercase", letterSpacing: 1 }}>Narração ao vivo</div>
          <div style={{ display: "grid", gap: 5, marginTop: 10, maxHeight: 560, overflowY: "auto" }}>
            {feed.map((l, i) => (<div key={i} style={{ fontSize: 12, color: i === 0 ? INK : DIM, fontFamily: MONO, lineHeight: 1.45 }}>{l}</div>))}
          </div>
        </aside>
      </div>

      {editTeam && !onBroadcast && lineups[editTeam] && byId.get(editTeam) && (
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

/** One commentary line for any match event. */
function describe(e: MatchEvent, m: BracketMatch, code: (id: string | null) => string): string {
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

function MatchCell({
  m, live, spot, hs, as: aw, nick, code, onPick,
}: {
  m: BracketMatch;
  live: boolean;
  spot: boolean;
  hs: number | null;
  as: number | null;
  nick: (id: string | null) => string;
  code: (id: string | null) => string;
  onPick: () => void;
}) {
  const winner = m.status === "done" ? m.result?.winnerId : null;
  const isLive = live && m.status === "live";
  return (
    <div onClick={onPick} style={{ border: `1px solid ${isLive && spot ? "#fff" : isLive ? LIME : LINE}`, borderRadius: 8, overflow: "hidden", background: isLive ? "rgba(200,255,45,0.06)" : "rgba(255,255,255,0.02)", cursor: isLive ? "pointer" : "default", boxShadow: isLive && spot ? "0 0 0 1px rgba(255,255,255,0.5)" : "none" }}>
      <TeamLine id={m.homeId} name={nick(m.homeId)} code={code(m.homeId)} score={hs} win={winner === m.homeId} />
      <div style={{ height: 1, background: LINE }} />
      <TeamLine id={m.awayId} name={nick(m.awayId)} code={code(m.awayId)} score={aw} win={winner === m.awayId} />
      {m.result?.pens && m.status === "done" && (
        <div style={{ fontFamily: MONO, fontSize: 9, color: DIM, textAlign: "center", padding: "1px 0", background: "rgba(0,0,0,0.2)" }}>pên {m.result.pens.home}-{m.result.pens.away}</div>
      )}
    </div>
  );
}

function TeamLine({ id, name, code, score, win }: { id: string | null; name: string; code: string; score: number | null; win: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 6px", opacity: id ? 1 : 0.4 }}>
      {id ? <FlagIcon code={code} size={11} /> : <span style={{ width: 15 }} />}
      <span style={{ flex: 1, fontSize: 11.5, fontWeight: win ? 800 : 500, color: win ? LIME : INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={name}>{id ? name : "—"}</span>
      <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: score == null ? DIM : INK, minWidth: 12, textAlign: "right" }}>{score == null ? "" : score}</span>
    </div>
  );
}

const panel: React.CSSProperties = { background: "transparent", border: `1px solid ${LINE}`, borderRadius: 16, padding: 16 };
const primaryBtn: React.CSSProperties = { padding: "9px 16px", borderRadius: 10, border: "none", background: LIME, color: "#0a120d", fontWeight: 800, fontSize: 14, fontFamily: DISP, cursor: "pointer" };
const smallBtn: React.CSSProperties = { padding: "8px 12px", borderRadius: 9, border: `1px solid ${LINE}`, background: "rgba(255,255,255,0.04)", color: INK, fontSize: 13, fontWeight: 600, cursor: "pointer" };
const chip: React.CSSProperties = { padding: "7px 11px", borderRadius: 999, border: `1px solid ${LINE}`, background: "transparent", color: INK, fontFamily: MONO, fontSize: 12, cursor: "pointer" };
