"use client";
import { PixelLabAnim } from "@/components/pixellab-anim";
import { craqueForTeam, CRAQUE_CLIPS, type CraqueBase } from "@/data/craque-map";
import { flagFileBase } from "@/lib/team-names";

// LOCAL EXPERIMENT — the team crest cycles flag (~2s) → craque (~6s), 8s loop.
// A persistent ring stays the whole time. During the flag phase the waving flag
// fills it; during the craque phase the team's craque (its hero idle clip, ANIMATED)
// rises from the bottom blurry→sharp and overflows the ring's top, head popping
// out — like the design mock. The ring sits behind the craque.

const ASSET_BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const CSS = `
.screst{position:relative;flex:0 0 auto}
.screst-flag{position:absolute;inset:0;border-radius:50%;overflow:hidden;background:rgba(255,255,255,0.05);z-index:1;animation:scFlag 8s ease-in-out infinite}
.screst-wave{position:absolute;inset:-8%;animation:bfwave 4.5s ease-in-out infinite}
.screst-wave img{width:100%;height:100%;object-fit:cover}
.screst-sheen{position:absolute;top:0;bottom:0;left:0;width:46%;background:linear-gradient(100deg,transparent,rgba(255,255,255,0.4),transparent);animation:bfsheen 5s linear infinite}
.screst-ring{position:absolute;inset:0;border-radius:50%;z-index:2;pointer-events:none}
.screst-craque{position:absolute;left:0;right:0;bottom:0;z-index:3;display:flex;justify-content:center;align-items:flex-end;pointer-events:none;transform-origin:center bottom;animation:scCraque 8s cubic-bezier(.2,.7,.2,1) infinite}
@keyframes scFlag{0%,25%{opacity:1}31%,95%{opacity:0}100%{opacity:1}}
@keyframes scCraque{0%,25%{opacity:0;transform:translateY(42%) scale(.5);filter:blur(7px)}34%{opacity:1;transform:translateY(0) scale(1);filter:blur(0)}90%{opacity:1;transform:translateY(0) scale(1);filter:blur(0)}97%{opacity:0;transform:translateY(16%) scale(.72);filter:blur(4px)}100%{opacity:0}}
`;

export function SwitchingCrest({ code, accent, size = 74, craque, flip = false }: { code: string; accent: string; size?: number; craque?: CraqueBase | null; flip?: boolean }) {
  const base = craque !== undefined ? craque : craqueForTeam(code);
  const hero = base ? CRAQUE_CLIPS[base].hero : null;
  const flag = flagFileBase(code);
  return (
    <div className="screst" style={{ width: size, height: size }}>
      <style>{CSS}</style>
      <div className="screst-flag">
        {flag ? (
          <div className="screst-wave">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${ASSET_BASE}/flags/${flag}.svg`} alt="" />
            <div className="screst-sheen" />
          </div>
        ) : (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: Math.round(size * 0.26), color: accent }}>{code}</div>
        )}
      </div>
      <div className="screst-ring" style={{ border: `2px solid ${accent}aa`, boxShadow: `0 0 26px -8px ${accent}` }} />
      {base && hero ? (
        <div className="screst-craque" style={{ height: size * 1.55 }}>
          <div style={{ transform: flip ? "scaleX(-1)" : undefined }}>
            <PixelLabAnim dir={`/pixellab-assets/${base}/anim/${hero.key}`} frames={hero.frames} size={92} scale={(size * 1.55) / 92} fps={hero.frames <= 4 ? 3 : 4} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
