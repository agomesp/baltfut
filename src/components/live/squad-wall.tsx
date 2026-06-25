"use client";
import { SQUAD_BODIES, CRAQUE_GLOW, type CraqueBase } from "@/data/craque-map";

// LOCAL EXPERIMENT — a faded grayscale "squad wall" behind each team (the
// escalação placeholder, our generic sprites). On mount the players enter
// staggered (left→right, top→bottom). Each has a team-colored halo that PULSES
// — a separate blurred radial layer animating only opacity + scale (GPU
// composited = smooth), so the figure's own filter never animates.

const ASSET_BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const STAGGER = 0.1;

const CSS = `
.swall{position:absolute;top:0;bottom:0;width:46%;overflow:hidden;display:flex;align-items:flex-start;z-index:0;pointer-events:none}
.swall.home{left:0;justify-content:flex-start;-webkit-mask-image:linear-gradient(to right,#000 50%,transparent);mask-image:linear-gradient(to right,#000 50%,transparent)}
.swall.away{right:0;justify-content:flex-end;-webkit-mask-image:linear-gradient(to left,#000 50%,transparent);mask-image:linear-gradient(to left,#000 50%,transparent)}
.swall-char{position:relative;flex:0 0 auto;height:190%;margin-inline:-19%;opacity:0;animation:swallIn .55s ease-out both}
.swall-char>img{display:block;height:100%;width:auto;object-fit:contain;image-rendering:pixelated;filter:grayscale(1) brightness(.62);opacity:.4;position:relative;z-index:1}
.swall-aura{position:absolute;left:50%;top:27%;width:54%;aspect-ratio:1/1;border-radius:50%;background:radial-gradient(circle,var(--glow,#c8ff2d) 0%,transparent 64%);filter:blur(9px);z-index:0;opacity:.12;will-change:opacity,transform;animation:swallPulse 3.4s ease-in-out infinite}
@keyframes swallIn{0%{opacity:0;transform:translateY(-22px)}100%{opacity:1;transform:translateY(0)}}
@keyframes swallPulse{0%,100%{opacity:.1;transform:translate(-50%,-50%) scale(.82)}50%{opacity:.46;transform:translate(-50%,-50%) scale(1.14)}}
`;

/** Pixel sprites for one side's wall (craque mixed with the 3 generic bodies). */
function lineupFor(base: string): string[] {
  const [a, b, c] = SQUAD_BODIES;
  return [a, base, b, c, base, a];
}

export function SquadWall({ base, side, delayBase = 0 }: { base: CraqueBase | null; side: "home" | "away"; delayBase?: number }) {
  const b: CraqueBase = base ?? "england-craque-test";
  const glow = CRAQUE_GLOW[b];
  const sprites = lineupFor(b);
  return (
    <div className={`swall ${side}`}>
      <style>{CSS}</style>
      {sprites.map((s, i) => (
        <div key={i} className="swall-char" style={{ animationDelay: `${delayBase + i * STAGGER}s`, ["--glow" as string]: glow } as React.CSSProperties}>
          <div className="swall-aura" style={{ animationDelay: `-${(i % 4) * 0.8}s` }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${ASSET_BASE}/pixellab-assets/${s}/south.png`} alt="" />
        </div>
      ))}
    </div>
  );
}
