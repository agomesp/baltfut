"use client";

import { useMemo } from "react";
import { usePromos } from "@/lib/use-promos";
import { pickGoalPromo } from "@/lib/promos";
import { ARCHIVO, BRIC, JB, SAIRA, LIME, GOLD } from "@/components/live/bf-ui";

/**
 * A brief RB Store deal shown on the lower/back part of the screen DURING a goal
 * cinematic — turning the goal (the attention peak, when the hero clears for the
 * celebration) into a sponsor moment. Purely presentational + pointer-events:none,
 * so it never blocks anything; the parent (HeroWithCinematic) mounts it only while a
 * GOAL cinematic is active and re-keys it per goal (runId). Its own animation is
 * timed to the ~6s cinematic: rises in, holds, fades out.
 */
export function GoalPromo({ runId }: { runId: number }) {
  const promos = usePromos();
  const p = useMemo(() => pickGoalPromo(promos, runId), [promos, runId]);
  if (!p) return null;
  return (
    <div
      aria-hidden
      style={{
        position: "fixed", left: 0, right: 0, top: "34vh", bottom: 0, zIndex: 1,
        display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "3vh",
        pointerEvents: "none", animation: "goalPromoIn 6s ease-out both",
      }}
    >
      <style>{"@keyframes goalPromoIn{0%,17%{opacity:0;transform:translateY(26px) scale(.96)}30%{opacity:1;transform:none}86%{opacity:1;transform:none}100%{opacity:0;transform:translateY(-10px)}}"}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 20, width: "min(92vw, 740px)", background: "linear-gradient(180deg, rgba(20,38,26,0.92), rgba(10,20,13,0.94))", border: `1px solid ${LIME}44`, borderRadius: 20, padding: 18, boxShadow: `0 22px 64px -12px rgba(0,0,0,0.72), 0 0 44px -10px ${LIME}44` }}>
        {p.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image} alt="" referrerPolicy="no-referrer" style={{ width: 150, height: 132, objectFit: p.cutout ? "contain" : "cover", borderRadius: 14, flex: "none", background: p.cutout ? "transparent" : "#0e1b14", filter: p.cutout ? "drop-shadow(0 12px 16px rgba(0,0,0,0.55))" : "none" }} />
        ) : null}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: JB, fontSize: 12, letterSpacing: "0.12em", color: GOLD, marginBottom: 6 }}>⚽ GOOOL! · OFERTA DO GRUPO</div>
          <div style={{ fontFamily: BRIC, fontWeight: 800, fontSize: "clamp(18px,2.2vw,26px)", lineHeight: 1.08, color: "#f4f8f2", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>{p.product}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
            {p.price ? <span style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: "clamp(26px,3vw,38px)", color: LIME, lineHeight: 0.9 }}>{p.price}</span> : null}
            {p.discount != null ? <span style={{ fontFamily: JB, fontWeight: 800, fontSize: 14, color: "#241a00", background: "#ffce3a", padding: "3px 10px", borderRadius: 8 }}>-{p.discount}%</span> : null}
          </div>
        </div>
        <span style={{ fontFamily: ARCHIVO, fontWeight: 800, fontSize: 13, color: "#0f1f02", background: LIME, padding: "10px 16px", borderRadius: 12, flex: "none", whiteSpace: "nowrap" }}>🛒 rbstore.net</span>
      </div>
    </div>
  );
}
