"use client";

// The streamer's promo view inside the live tab: defaults to the auto-rotating
// Spotlight (big single deal + QR), with a corner toggle to the full scrollable
// grid ("grade"). Mounted in place of the palpites area when promos are on.
import { useState } from "react";
import { LivePromosPanel } from "@/components/live/live-promos-panel";
import { PromoSpotlight } from "@/components/live/promo-spotlight";
import { JB } from "@/components/live/bf-ui";

export function LivePromoView() {
  const [mode, setMode] = useState<"spotlight" | "grade">("spotlight");
  return (
    <div style={{ position: "relative", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      {mode === "spotlight" ? <PromoSpotlight /> : <LivePromosPanel />}
      <button
        type="button"
        onClick={() => setMode((m) => (m === "spotlight" ? "grade" : "spotlight"))}
        title={mode === "spotlight" ? "Ver todas em grade" : "Ver oferta em destaque"}
        style={{ position: "absolute", top: 4, right: 4, zIndex: 6, fontFamily: JB, fontSize: 9.5, letterSpacing: "0.05em", textTransform: "uppercase", color: "#cfe8c0", background: "rgba(10,20,13,0.85)", border: "1px solid rgba(200,255,45,0.3)", borderRadius: 8, padding: "5px 10px", cursor: "pointer" }}
      >
        {mode === "spotlight" ? "⊞ grade" : "◆ destaque"}
      </button>
    </div>
  );
}
