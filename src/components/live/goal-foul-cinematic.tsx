"use client";
import { useEffect, useState } from "react";
import { PixelLabAnim } from "@/components/pixellab-anim";
import { FlagCrest, teamAccent, SAIRA, BRIC } from "@/components/live/bf-ui";
import { teamNamePt } from "@/lib/team-names";
import type { ClipInfo } from "@/data/craque-map";

// LOCAL EXPERIMENT (/testsprite + AO VIVO). Cinematic on a goal/card: the teams
// slide off + score fades; the scorer's craque stands ready in the middle; a
// ball (goal) or card (foul) appears HUGE at the bottom EDGE OF THE SCREEN and
// flies a long spinning arc — up to the top, out to the far right, then back
// down onto the player. The player kicks/slides to meet it; on impact the stage
// shakes + flashes. Then it all returns. ~6s, re-keyed by runId to replay.
//
// The projectile is a position:fixed VIEWPORT layer (so it enters from the real
// screen edge, not the hero box). LAND_VH is where it meets the player's foot —
// the one value to tune if the ball doesn't land on the sprite.

export type CineMode = "goal" | "yellow" | "red";

const T = "6s";
export const TOTAL_MS = 6000;
const IMPACT_FRAC = 0.84;
const ACTION_SECONDS = 1.1; // the kick/slide plays over this, ending at impact
const KICK_START_MS = Math.round(IMPACT_FRAC * TOTAL_MS - ACTION_SECONDS * 1000);
const LAND_VH = 26; // viewport height % where the ball meets the player's foot

const CSS = `
.cine{position:relative;overflow:hidden;height:100%;min-height:200px;border-radius:12px;background:linear-gradient(180deg,rgba(200,255,45,0.04),transparent);border:1px solid rgba(200,255,45,0.12);transform-origin:center center}
.cine.play{animation:cineShake ${T} cubic-bezier(.3,0,.3,1) both}
.cine .c-row{position:relative;z-index:2;display:flex;align-items:center;justify-content:center;gap:clamp(14px,2.4vw,28px);padding:26px 22px;min-height:200px}
.cine .c-team{display:flex;flex-direction:column;align-items:center;gap:8px;flex:1;min-width:0}
.cine .c-name{font-family:${BRIC};font-weight:800;font-size:clamp(14px,1.8vw,22px);letter-spacing:-0.02em;line-height:1;white-space:nowrap}
.cine .c-score{display:flex;align-items:center;gap:11px;flex:none}
.cine .c-num{font-family:${SAIRA};font-weight:800;font-size:clamp(40px,6vw,72px);line-height:.74;color:#fff}
.cine .c-dash{width:22px;height:5px;border-radius:4px;background:#c8ff2d;box-shadow:0 0 14px rgba(200,255,45,.5)}
.cine.play .c-home{animation:cineTeamL ${T} ease-in-out both}
.cine.play .c-away{animation:cineTeamR ${T} ease-in-out both}
.cine.play .c-score{animation:cineScore ${T} ease-in-out both}
.cine .c-stage{position:absolute;inset:0;z-index:3;display:flex;align-items:flex-end;justify-content:center;pointer-events:none}
.cine .c-player{position:relative;bottom:-6px;opacity:0;transform-origin:center bottom}
.cine.play .c-player{animation:cinePlayer ${T} cubic-bezier(.2,.7,.2,1) both}
.cine .c-flash{position:absolute;inset:0;z-index:5;pointer-events:none;opacity:0}
.cine.play .c-flash{animation:cineFlash ${T} ease-out both}

.c-proj-fix{position:fixed;left:50vw;top:112vh;z-index:80;opacity:0;transform-origin:center;pointer-events:none;animation:cineProjFix ${T} cubic-bezier(.45,0,.55,1) both}
.c-proj-fix .c-ball{width:34px;height:34px}
.c-proj-fix .c-card{width:28px;height:40px;border-radius:4px;box-shadow:0 6px 18px rgba(0,0,0,.55)}

@keyframes cineTeamL{0%,1%{transform:none;opacity:1}9%{transform:translateX(-160%);opacity:0}88%{transform:translateX(-160%);opacity:0}97%,100%{transform:none;opacity:1}}
@keyframes cineTeamR{0%,1%{transform:none;opacity:1}9%{transform:translateX(160%);opacity:0}88%{transform:translateX(160%);opacity:0}97%,100%{transform:none;opacity:1}}
@keyframes cineScore{0%,2%{opacity:1;transform:scale(1)}8%{opacity:0;transform:scale(.7)}88%{opacity:0;transform:scale(.7)}94%{opacity:1;transform:scale(1.18)}98%,100%{opacity:1;transform:scale(1)}}
@keyframes cinePlayer{0%,6%{opacity:0;transform:translateY(26px) scale(.32)}15%{opacity:1;transform:translateY(-10px) scale(1.08)}19%,85%{opacity:1;transform:translateY(0) scale(1)}91%{opacity:0;transform:translateY(-14px) scale(.66)}100%{opacity:0}}
@keyframes cineFlash{0%,82%{opacity:0}${IMPACT_FRAC * 100}%{opacity:.9}90%{opacity:0}100%{opacity:0}}
@keyframes cineShake{0%,82%{transform:translate(0,0) scale(1)}83%{transform:translate(-8px,4px) scale(1.03)}85%{transform:translate(9px,-4px) scale(1.03)}87%{transform:translate(-6px,-3px) scale(1.02)}89%{transform:translate(5px,3px) scale(1.01)}91%{transform:translate(0,0) scale(1)}100%{transform:translate(0,0)}}
@keyframes cineProjFix{0%{opacity:0;left:50vw;top:112vh;transform:translate(-50%,-50%) scale(9) rotate(0deg);filter:blur(5px)}5%{opacity:1;filter:blur(2px)}18%{left:36vw;top:36vh;transform:translate(-50%,-50%) scale(4) rotate(420deg);filter:blur(0)}36%{left:82vw;top:6vh;transform:translate(-50%,-50%) scale(1.8) rotate(1000deg)}54%{left:100vw;top:22vh;transform:translate(-50%,-50%) scale(1) rotate(1640deg)}73%{left:62vw;top:${LAND_VH + 8}vh;transform:translate(-50%,-50%) scale(.6) rotate(2360deg)}82%{opacity:1;left:50vw;top:${LAND_VH}vh;transform:translate(-50%,-50%) scale(.4) rotate(2880deg)}${IMPACT_FRAC * 100}%{opacity:0;left:50vw;top:${LAND_VH + 3}vh;transform:translate(-50%,-50%) scale(.26) rotate(2940deg)}100%{opacity:0}}
`;

function Ball() {
  return (
    <svg className="c-ball" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="11" fill="#fff" stroke="#0a0a0a" strokeWidth="1" />
      <polygon points="12,7 16,10 14,15 10,15 8,10" fill="#0a0a0a" />
    </svg>
  );
}

export function GoalFoulCinematic({
  runId,
  mode,
  side,
  homeCode,
  awayCode,
  scorerBase,
  scorerClip,
  idleClip,
  homeScore,
  awayScore,
}: {
  runId: number;
  mode: CineMode;
  side: "home" | "away";
  homeCode: string;
  awayCode: string;
  scorerBase: string;
  scorerClip: ClipInfo;
  /** Hero idle clip played while waiting for the ball (null = hold ready frame). */
  idleClip?: ClipInfo | null;
  homeScore: number;
  awayScore: number;
}) {
  const homeAccent = teamAccent(homeCode);
  const awayAccent = teamAccent(awayCode);
  const accent = side === "home" ? homeAccent : awayAccent;
  const cardColor = mode === "red" ? "#e5343d" : "#f5c518";

  // Hold the sprite on frame 0 (ready) during the arc, then play the kick/slide
  // so its contact meets the projectile at impact.
  const [acting, setActing] = useState(false);
  useEffect(() => {
    if (runId <= 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActing(false);
    const t = setTimeout(() => setActing(true), KICK_START_MS);
    return () => clearTimeout(t);
  }, [runId]);

  // While waiting (ball still flying) play the craque's hero idle, looping; once
  // the ball is close (acting), swap to the kick/slide timed to land at impact.
  const idleNow = !!idleClip && !acting;
  const clip: ClipInfo = idleNow ? (idleClip as ClipInfo) : scorerClip;
  const playerDir = `/pixellab-assets/${scorerBase}/anim/${clip.key}`;
  const clipFps = idleNow ? (clip.frames <= 4 ? 3 : 4) : scorerClip.frames / ACTION_SECONDS;

  return (
    <>
      <style>{CSS}</style>
      <div key={runId} className={runId > 0 ? "cine play" : "cine"}>
        <div className="c-row">
          <div className="c-team c-home">
            <FlagCrest code={homeCode} accent={homeAccent} size={70} />
            <div className="c-name" style={{ color: homeAccent }}>{teamNamePt(homeCode, homeCode).toUpperCase()}</div>
          </div>
          <div className="c-score">
            <span className="c-num">{homeScore}</span>
            <span className="c-dash" />
            <span className="c-num">{awayScore}</span>
          </div>
          <div className="c-team c-away">
            <FlagCrest code={awayCode} accent={awayAccent} size={70} />
            <div className="c-name" style={{ color: awayAccent }}>{teamNamePt(awayCode, awayCode).toUpperCase()}</div>
          </div>
        </div>

        {runId > 0 ? (
          <>
            <div className="c-stage">
              <div className="c-player">
                {/* Right/away team faces left — just mirror the sprite. */}
                <div style={{ transform: side === "away" ? "scaleX(-1)" : undefined }}>
                  <PixelLabAnim key={idleNow ? "idle" : "act"} dir={playerDir} frames={clip.frames} size={92} scale={1.7} fps={clipFps} loop={idleNow} playing={idleNow ? true : acting} />
                </div>
              </div>
            </div>
            <div className="c-flash" style={{ background: `radial-gradient(circle at 50% 62%, ${accent}cc, transparent 55%)` }} />
          </>
        ) : null}
      </div>
      {runId > 0 ? (
        <div key={`proj-${runId}`} className="c-proj-fix" aria-hidden>
          {mode === "goal" ? <Ball /> : <div className="c-card" style={{ background: cardColor }} />}
        </div>
      ) : null}
    </>
  );
}
