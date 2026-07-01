"use client";

// Watch-together VIEWER — reconstructs the host's exact live match from the tiny
// BroadcastState + the shared Date.now() clock (no video, no positions). Read-only:
// no controls, it just follows. Reuses the real PitchView + the deterministic
// replay; the pitch motion is cosmetic (unseeded) so only the scoreline + timing
// sync, which is the point.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlagIcon } from "@/components/live/bf-ui";
import PitchView from "@/components/subs-draft2/pitch-view";
import { createWatchChannel } from "@/lib/subs-draft/watch-channel";
import { subscribeMetronome } from "@/lib/subs-draft/sim-metronome";
import { validateBroadcastState, validateField, viewerMinute, type BroadcastState } from "@/lib/subs-draft/watch-sync";
import { replayWorld } from "@/lib/subs-draft/watch-replay";
import { standings, MATCHDAY_NAMES, groupMatchSeed, type GroupMatch } from "@/lib/subs-draft/groups";
import { ROUND_NAMES, bracketMatchSeed, type BracketMatch } from "@/lib/subs-draft/tournament";
import { autoLineup, DEFAULT_FORMATION } from "@/lib/subs-draft/squad";
import type { Team } from "@/lib/subs-draft/engine";

const LIME = "#c8ff2d";
const AMBER = "#f2a93b";
const INK = "#e7f0e9";
const DIM = "#7e8f84";
const LINE = "rgba(200,255,45,0.14)";
const DISP = "var(--font-bric, system-ui)";
const MONO = "var(--font-jb, ui-monospace)";

export default function WatchView({ id }: { id: string }) {
  const [state, setState] = useState<BroadcastState | null>(null);
  const [field, setField] = useState<Team[] | null>(null); // the drafted rosters (null until they arrive)
  const [viewers, setViewers] = useState(1);
  const [clock, setClock] = useState(0);
  const stateRef = useRef<BroadcastState | null>(null);
  const fieldSigRef = useRef<string>("");

  // subscribe: receive snapshots + the room field + presence
  useEffect(() => {
    const ch = createWatchChannel(id);
    ch.onState((raw) => {
      const s = validateBroadcastState(raw);
      if (s) { stateRef.current = s; setState(s); }
    });
    ch.onField((raw) => {
      const f = validateField(raw);
      if (!f) return;
      // the host re-sends the field every beat; ignore identical re-sends so an
      // unchanged field never re-triggers the (expensive) full-tournament replay.
      const sig = f.length + ":" + f.map((t) => t.id).join(",");
      if (sig === fieldSigRef.current) return;
      fieldSigRef.current = sig;
      setField(f);
    });
    ch.onPresence((n) => setViewers(Math.max(1, n)));
    ch.setPresent();
    return () => ch.close();
  }, [id]);

  // the shared clock: derive the match minute from Date.now() + the host's epoch
  useEffect(() => {
    const tick = () => { if (stateRef.current) setClock(viewerMinute(stateRef.current, Date.now())); };
    const t = setInterval(tick, 100);
    const unsub = subscribeMetronome(tick);
    return () => { clearInterval(t); unsub(); };
  }, []);

  // reconstruct the world only when the STAGE changes (not on spotlight/minute)
  const teamIdsKey = (state?.teamIds ?? []).join(",");
  // Gate on the FIELD: rebuild the world only once we have the room's teams. A drafted
  // room's state can land before its ~35KB field, and replaying against the wrong/absent
  // roster would silently show a different tournament (or crash drawGroups on a non-48
  // field). `field` identity changes only when its content changes, so the world (a full
  // replay) rebuilds when the field first arrives / shrinks 48→32, not on every re-send.
  const world = useMemo(
    () => (state && field && (state.phase !== "groups" || field.length === 48) ? replayWorld(state, field) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state?.phase, state?.seed, state?.stageIdx, state?.done, teamIdsKey, field],
  );

  const spotMatch = useMemo(() => {
    if (!state || !world) return null;
    if (world.phase === "groups" && world.stage) {
      for (const g of world.stage.groups) {
        const m = (g.matchdays[state.stageIdx] ?? []).find((x) => x.id === state.spotlight && x.status === "live" && x.result);
        if (m) return m as GroupMatch;
      }
    } else if (world.bracket) {
      const m = (world.bracket[state.stageIdx] ?? []).find((x) => x.id === state.spotlight && x.status === "live" && x.result);
      if (m) return m ?? null;
    }
    return null;
  }, [world, state]);

  // Smooth match progress (0..1) from the SHARED clock — so the viewer's authoritative
  // spotlight sim (same seed as the host) steps ~1 tick/frame and stays goal-synced.
  const progressAt = useCallback(() => {
    const s = stateRef.current;
    return s ? Math.max(0, Math.min(1, viewerMinute(s, Date.now()) / 90)) : 0;
  }, []);

  const code = (tid: string | null) => (tid ? world?.byId.get(tid)?.code ?? "" : "");
  const nick = (tid: string | null) => (tid ? world?.byId.get(tid)?.owner.replace(" 🤖", "") ?? "?" : "?");

  const liveGoals = (m: { homeId: string | null; awayId: string | null; result: { events: { type: string; teamId: string; minute: number }[] } | null }, side: "home" | "away") => {
    if (!m.result) return 0;
    const id = side === "home" ? m.homeId : m.awayId;
    return m.result.events.filter((e) => e.type === "goal" && e.teamId === id && e.minute <= clock).length;
  };

  if (!state || !world) {
    return (
      <div style={{ ...panel, textAlign: "center", padding: 40 }}>
        <div style={{ fontFamily: DISP, fontSize: 20, fontWeight: 800 }}>Conectando à transmissão…</div>
        <div style={{ fontSize: 13, color: DIM, marginTop: 8 }}>Sala <code style={{ color: LIME }}>{id}</code></div>
      </div>
    );
  }

  const stageLabel = world.phase === "groups" ? MATCHDAY_NAMES[state.stageIdx] ?? "Grupos" : ROUND_NAMES[state.stageIdx] ?? "Mata-mata";

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* live banner */}
      <section style={{ ...panel, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", border: `1px solid ${LIME}`, background: "rgba(200,255,45,0.06)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: DISP, fontWeight: 800 }}>
          <span style={{ width: 9, height: 9, borderRadius: 999, background: "#ff4d4d", boxShadow: "0 0 8px #ff4d4d" }} /> AO VIVO
        </span>
        <span style={{ fontFamily: MONO, fontSize: 12, color: DIM }}>
          {world.phase === "groups" ? "Fase de grupos" : "Mata-mata"} · <span style={{ color: LIME, fontWeight: 800 }}>{stageLabel}</span>
          {state.playing || clock > 0 ? ` · ${Math.round(clock)}'` : ""}
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: MONO, fontSize: 12, color: INK }}>👥 {viewers} assistindo junto{viewers > 1 ? "s" : ""}</span>
      </section>

      {/* spotlight pitch */}
      {spotMatch && spotMatch.homeId && spotMatch.awayId && (
        <section style={{ ...panel, padding: 0, overflow: "hidden" }}>
          <div style={{ fontFamily: MONO, fontSize: 11, color: DIM, textTransform: "uppercase", letterSpacing: 1, padding: "12px 14px 0" }}>Jogo em destaque · {stageLabel}</div>
          <PitchView
            key={spotMatch.id}
            home={world.byId.get(spotMatch.homeId)!}
            away={world.byId.get(spotMatch.awayId)!}
            homeLineup={world.lineups[spotMatch.homeId] ?? autoLineup(world.byId.get(spotMatch.homeId)!, DEFAULT_FORMATION, {})}
            awayLineup={world.lineups[spotMatch.awayId] ?? autoLineup(world.byId.get(spotMatch.awayId)!, DEFAULT_FORMATION, {})}
            homeCode={code(spotMatch.homeId)}
            awayCode={code(spotMatch.awayId)}
            progressAt={progressAt}
            clock={clock}
            playing={state.playing}
            seed={"matchday" in spotMatch
              ? groupMatchSeed(state.seed, spotMatch.group, spotMatch.matchday, spotMatch.slot)
              : bracketMatchSeed(state.seed, spotMatch.round, spotMatch.slot)}
          />
        </section>
      )}

      {/* groups: 12 standings tables */}
      {world.phase === "groups" && world.stage && (
        <section style={{ ...panel, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px,1fr))", gap: 12 }}>
          {world.stage.groups.map((g) => {
            const table = standings(g, world.stage!.seed);
            const played = table.some((r) => r.P > 0);
            return (
              <div key={g.name} style={{ border: `1px solid ${LINE}`, borderRadius: 10, overflow: "hidden" }}>
                <div style={{ padding: "5px 9px", background: "rgba(200,255,45,0.06)", borderBottom: `1px solid ${LINE}`, fontFamily: DISP, fontWeight: 800, fontSize: 12 }}>Grupo {g.name}</div>
                {table.map((r, pos) => {
                  const q = !played ? null : pos < 2 ? LIME : pos === 2 ? AMBER : null;
                  return (
                    <div key={r.teamId} style={{ display: "grid", gridTemplateColumns: "14px 1fr 16px 20px", gap: 4, alignItems: "center", padding: "3px 9px", background: q ? `${q}14` : "transparent" }}>
                      <span style={{ fontFamily: MONO, fontSize: 9.5, color: q ?? DIM }}>{pos + 1}</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
                        <FlagIcon code={code(r.teamId)} size={10} />
                        <span style={{ fontSize: 10.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: q ?? INK }}>{nick(r.teamId)}</span>
                      </span>
                      <span style={{ fontFamily: MONO, fontSize: 9.5, color: DIM, textAlign: "center" }}>{r.GD > 0 ? `+${r.GD}` : r.GD}</span>
                      <span style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 800, textAlign: "right" }}>{r.Pts}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </section>
      )}

      {/* bracket */}
      {world.phase === "bracket" && world.bracket && (
        <section style={{ ...panel, overflowX: "auto" }}>
          <div style={{ display: "flex", gap: 10, minWidth: 760 }}>
            {world.bracket.map((round, r) => (
              <div key={r} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-around", gap: 6, minWidth: 130 }}>
                <div style={{ fontFamily: MONO, fontSize: 10, color: r === state.stageIdx ? LIME : DIM, textAlign: "center" }}>{ROUND_NAMES[r]}</div>
                {round.map((m: BracketMatch) => {
                  const win = m.status === "done" ? m.result?.winnerId : null;
                  const live = r === state.stageIdx && m.status === "live";
                  const hs = m.result ? (m.status === "done" ? m.result.homeGoals : liveGoals(m, "home")) : null;
                  const as = m.result ? (m.status === "done" ? m.result.awayGoals : liveGoals(m, "away")) : null;
                  return (
                    <div key={m.id} style={{ border: `1px solid ${live ? LIME : LINE}`, borderRadius: 8, overflow: "hidden", background: live ? "rgba(200,255,45,0.06)" : "transparent" }}>
                      <TeamLine code={code(m.homeId)} name={nick(m.homeId)} score={hs} win={win === m.homeId} on={!!m.homeId} />
                      <div style={{ height: 1, background: LINE }} />
                      <TeamLine code={code(m.awayId)} name={nick(m.awayId)} score={as} win={win === m.awayId} on={!!m.awayId} />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function TeamLine({ code, name, score, win, on }: { code: string; name: string; score: number | null; win: boolean; on: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 6px", opacity: on ? 1 : 0.4 }}>
      {on ? <FlagIcon code={code} size={11} /> : <span style={{ width: 15 }} />}
      <span style={{ flex: 1, fontSize: 11.5, fontWeight: win ? 800 : 500, color: win ? LIME : INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{on ? name : "—"}</span>
      <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: score == null ? DIM : INK, minWidth: 12, textAlign: "right" }}>{score == null ? "" : score}</span>
    </div>
  );
}

const panel: React.CSSProperties = { background: "transparent", border: `1px solid ${LINE}`, borderRadius: 16, padding: 16 };
