"use client";
import { useEffect, useRef, useState } from "react";
import { HeroScoreboard, type HeroScoreboardProps } from "@/components/live/hero-scoreboard";
import { GoalFoulCinematic, type CineMode } from "@/components/live/goal-foul-cinematic";
import { GoalPromo } from "@/components/live/goal-promo";
import { resolveCraquePair, CRAQUE_CLIPS, ANIMATED_SQUAD, SQUAD_CLIPS } from "@/data/craque-map";

// Wraps the single-game AO VIVO hero with the goal/foul cinematic: it fires on a
// real score/card delta, hides the static hero, and overlays the cinematic + a
// full-screen blur backdrop.

const CINE_MS = 6200;

interface Cfg {
  runId: number;
  mode: CineMode;
  side: "home" | "away";
}

export function HeroWithCinematic(props: HeroScoreboardProps) {
  const { match } = props;
  const [cfg, setCfg] = useState<Cfg>({ runId: 0, mode: "goal", side: "home" });
  const [active, setActive] = useState(false);
  const seq = useRef(0);
  const prev = useRef({ id: match.id, home: match.homeScore ?? 0, away: match.awayScore ?? 0, cards: match.cards.length });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function trigger(mode: CineMode, side: "home" | "away") {
    seq.current += 1;
    setCfg({ runId: seq.current, mode, side });
    setActive(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setActive(false), CINE_MS);
  }

  useEffect(() => {
    const h = match.homeScore ?? 0;
    const a = match.awayScore ?? 0;
    const cards = match.cards.length;
    const p = prev.current;
    if (p.id !== match.id) {
      prev.current = { id: match.id, home: h, away: a, cards };
      if (timer.current) clearTimeout(timer.current);
      setActive(false);
      return;
    }
    if (h > p.home) trigger("goal", "home");
    else if (a > p.away) trigger("goal", "away");
    else if (cards > p.cards) {
      const last = match.cards[match.cards.length - 1];
      trigger(last?.kind === "red" ? "red" : "yellow", last?.side === "away" ? "away" : "home");
    }
    prev.current = { id: match.id, home: h, away: a, cards };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.id, match.homeScore, match.awayScore, match.cards.length]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const pair = resolveCraquePair(match.home.abbreviation, match.away.abbreviation);
  const mapped = cfg.side === "home" ? pair.home : pair.away;
  const base = mapped ?? ANIMATED_SQUAD;
  const clips = mapped ? CRAQUE_CLIPS[mapped] : SQUAD_CLIPS;
  const clip = cfg.mode === "goal" ? clips.kick : clips.slide;
  const idleClip = mapped ? CRAQUE_CLIPS[mapped].hero : null;

  return (
    <div style={{ position: "relative", flex: "none", zIndex: active ? 60 : undefined }}>
      {active ? (
        <>
          <style>{"@keyframes cineBackdrop{0%,66%{opacity:0}80%{opacity:1}90%{opacity:1}100%{opacity:0}}"}</style>
          <div
            aria-hidden
            style={{ position: "fixed", inset: 0, zIndex: 1, background: "rgba(7,22,12,0.5)", backdropFilter: "blur(7px)", WebkitBackdropFilter: "blur(7px)", animation: "cineBackdrop 6s ease-out both", pointerEvents: "none" }}
          />
          {/* On a GOAL (not cards), flash a sponsor deal on the lower/back area. */}
          {cfg.mode === "goal" ? <GoalPromo runId={cfg.runId} /> : null}
        </>
      ) : null}
      <div style={{ opacity: active ? 0 : 1 }}>
        <HeroScoreboard {...props} />
      </div>
      {active ? (
        <div style={{ position: "absolute", inset: 0, zIndex: 2 }}>
          <GoalFoulCinematic
            runId={cfg.runId}
            mode={cfg.mode}
            side={cfg.side}
            homeCode={match.home.abbreviation}
            awayCode={match.away.abbreviation}
            scorerBase={base}
            scorerClip={clip}
            idleClip={idleClip}
            homeScore={match.homeScore ?? 0}
            awayScore={match.awayScore ?? 0}
          />
        </div>
      ) : null}
    </div>
  );
}
