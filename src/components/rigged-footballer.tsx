"use client";

// LOCAL EXPERIMENT (/testsprite). A *rigged* generic footballer: named SVG parts
// (legs/arms as groups) rotated about their joints by CSS keyframes, so football
// actions (run/kick/celebrate/slide) are authored in code — no pixel art, no
// likeness, team-colorable, crisp at any scale. Contrast with the LPC raster rig.

export type Kit = { jersey: string; shorts: string; skin: string; hair: string; boots: string };

export const KITS: { name: string; kit: Kit }[] = [
  { name: "England", kit: { jersey: "#ffffff", shorts: "#16224a", skin: "#e8b58e", hair: "#3a2a1a", boots: "#15171c" } },
  { name: "Brazil", kit: { jersey: "#f7d038", shorts: "#1f3aa6", skin: "#c98a57", hair: "#1b120b", boots: "#15171c" } },
  { name: "Argentina", kit: { jersey: "#8fc7e8", shorts: "#16243f", skin: "#e3b187", hair: "#241a12", boots: "#15171c" } },
];

export const ACTIONS = ["idle", "run", "kick", "celebrate", "slide"] as const;
export type Action = (typeof ACTIONS)[number];

// Joints live in the viewBox coordinate space (transform-box: view-box).
const CSS = `
.fb .arm-front,.fb .arm-back,.fb .leg-front,.fb .leg-back,.fb .figure,.fb .ball{transform-box:view-box}
.fb .leg-front{transform-origin:65px 96px}
.fb .leg-back{transform-origin:55px 96px}
.fb .arm-front{transform-origin:66px 48px}
.fb .arm-back{transform-origin:54px 48px}
.fb .figure{transform-origin:60px 96px}
.fb .ball{transform-origin:96px 150px}

/* IDLE */
.fb[data-act="idle"] .figure{animation:fbIdle 2.6s infinite ease-in-out}
.fb[data-act="idle"] .arm-front{transform:rotate(8deg)}
.fb[data-act="idle"] .arm-back{transform:rotate(-8deg)}
@keyframes fbIdle{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}

/* RUN */
.fb[data-act="run"] .leg-front{animation:fbRunF .55s infinite ease-in-out}
.fb[data-act="run"] .leg-back{animation:fbRunB .55s infinite ease-in-out}
.fb[data-act="run"] .arm-front{animation:fbRunAF .55s infinite ease-in-out}
.fb[data-act="run"] .arm-back{animation:fbRunAB .55s infinite ease-in-out}
.fb[data-act="run"] .figure{animation:fbRunBob .55s infinite}
.fb[data-act="run"] .ball{opacity:0}
@keyframes fbRunF{0%,100%{transform:rotate(32deg)}50%{transform:rotate(-34deg)}}
@keyframes fbRunB{0%,100%{transform:rotate(-34deg)}50%{transform:rotate(32deg)}}
@keyframes fbRunAF{0%,100%{transform:rotate(-30deg)}50%{transform:rotate(28deg)}}
@keyframes fbRunAB{0%,100%{transform:rotate(28deg)}50%{transform:rotate(-30deg)}}
@keyframes fbRunBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}

/* KICK */
.fb[data-act="kick"] .leg-front{animation:fbKick 1.15s infinite cubic-bezier(.45,0,.25,1)}
.fb[data-act="kick"] .leg-back{transform:rotate(12deg)}
.fb[data-act="kick"] .arm-back{animation:fbKickArm 1.15s infinite}
.fb[data-act="kick"] .arm-front{transform:rotate(-14deg)}
.fb[data-act="kick"] .ball{animation:fbBall 1.15s infinite cubic-bezier(.3,0,.2,1)}
@keyframes fbKick{0%{transform:rotate(-32deg)}32%{transform:rotate(-50deg)}50%{transform:rotate(80deg)}66%{transform:rotate(54deg)}100%{transform:rotate(-32deg)}}
@keyframes fbKickArm{0%,100%{transform:rotate(20deg)}50%{transform:rotate(-32deg)}}
@keyframes fbBall{0%,46%{transform:translate(0,0) scale(1);opacity:1}70%{transform:translate(34px,-62px) scale(.82);opacity:1}72%,100%{opacity:0}}

/* CELEBRATE */
.fb[data-act="celebrate"] .figure{animation:fbCeleb .7s infinite ease-in-out}
.fb[data-act="celebrate"] .arm-front{transform:rotate(-152deg)}
.fb[data-act="celebrate"] .arm-back{transform:rotate(152deg)}
.fb[data-act="celebrate"] .ball{opacity:0}
@keyframes fbCeleb{0%,100%{transform:translateY(0)}50%{transform:translateY(-16px)}}

/* SLIDE */
.fb[data-act="slide"] .figure{animation:fbSlide 1.7s infinite ease-in-out}
.fb[data-act="slide"] .leg-front{transform:rotate(-10deg)}
.fb[data-act="slide"] .leg-back{transform:rotate(26deg)}
.fb[data-act="slide"] .arm-back{transform:rotate(-44deg)}
.fb[data-act="slide"] .arm-front{transform:rotate(20deg)}
@keyframes fbSlide{0%{transform:translate(-12px,0) rotate(0)}32%{transform:translate(14px,12px) rotate(-66deg)}76%{transform:translate(42px,14px) rotate(-70deg)}100%{transform:translate(-12px,0) rotate(0)}}
`;

export function RiggedFootballer({
  action = "run",
  kit = KITS[0].kit,
  scale = 2,
}: {
  action?: Action;
  kit?: Kit;
  scale?: number;
}) {
  const W = 140;
  const H = 178;
  return (
    <>
      <style>{CSS}</style>
      <svg
        className="fb"
        data-act={action}
        width={W * scale}
        height={H * scale}
        viewBox={`0 0 ${W} ${H}`}
        aria-hidden
        style={{ display: "block", overflow: "visible" }}
      >
        <g className="figure">
          {/* back arm */}
          <g className="arm-back">
            <rect x="50" y="48" width="8" height="22" rx="4" fill={kit.jersey} />
            <rect x="50" y="68" width="8" height="16" rx="4" fill={kit.skin} />
          </g>
          {/* back leg */}
          <g className="leg-back">
            <rect x="50" y="96" width="11" height="20" rx="4" fill={kit.shorts} />
            <rect x="51" y="114" width="9" height="24" rx="4" fill={kit.skin} />
            <ellipse cx="56" cy="140" rx="9" ry="5" fill={kit.boots} />
          </g>
          {/* torso + head */}
          <rect x="49" y="45" width="22" height="53" rx="9" fill={kit.jersey} />
          <rect x="56" y="39" width="8" height="9" rx="2" fill={kit.skin} />
          <circle cx="60" cy="28" r="13" fill={kit.skin} />
          <path d="M47 28a13 13 0 0 1 26 0c-4 -6 -22 -6 -26 0z" fill={kit.hair} />
          {/* front leg */}
          <g className="leg-front">
            <rect x="59" y="96" width="11" height="20" rx="4" fill={kit.shorts} />
            <rect x="60" y="114" width="9" height="24" rx="4" fill={kit.skin} />
            <ellipse cx="65" cy="140" rx="10" ry="5" fill={kit.boots} />
          </g>
          {/* front arm */}
          <g className="arm-front">
            <rect x="63" y="48" width="8" height="22" rx="4" fill={kit.jersey} />
            <rect x="63" y="68" width="8" height="16" rx="4" fill={kit.skin} />
          </g>
        </g>
        {/* ball (world space, near the kicking foot) */}
        <g className="ball">
          <circle cx="96" cy="150" r="9" fill="#fff" stroke="#111" strokeWidth="1.2" />
          <polygon points="96,144 100,148 98,153 94,153 92,148" fill="#111" />
        </g>
      </svg>
    </>
  );
}
