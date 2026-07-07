"use client";

// A main-UI shortcut (next to the Modo Streamer button) to flip the live palpites
// area to the RB Store promo Spotlight and back — the same toggle the Modo Streamer
// PiP offers, surfaced so the streamer doesn't need the PiP open. Live-match only
// (the live view gates on phase === "live"); harmless to leave on otherwise.
import { useSyncExternalStore } from "react";
import { Gift } from "lucide-react";
import { togglePromoDisplay, isPromoDisplay, subscribePromoDisplay } from "@/lib/promo-display";

export function PromoToggleButton() {
  const on = useSyncExternalStore(subscribePromoDisplay, isPromoDisplay, () => false);
  return (
    <button
      type="button"
      onClick={() => togglePromoDisplay()}
      title={on ? "Voltar aos palpites" : "Mostrar as promoções da RB Store no lugar dos palpites (durante um jogo ao vivo)"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontFamily: "var(--font-jb)",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        padding: "9px 13px",
        borderRadius: 8,
        cursor: "pointer",
        boxShadow: "0 6px 22px rgba(0,0,0,0.4)",
        background: on ? "rgba(255,206,58,0.24)" : "rgba(255,206,58,0.13)",
        color: "#ffe6a3",
        border: `1px solid rgba(255,206,58,${on ? 0.75 : 0.5})`,
      }}
    >
      <Gift size={15} />
      {on ? "◀ Palpites" : "Mostrar Promos"}
    </button>
  );
}
