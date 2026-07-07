"use client";

// A main-UI shortcut (next to the Modo Streamer button) to flip the live palpites
// area to the RB Store promo Spotlight and back — the same toggle the Modo Streamer
// PiP offers, surfaced so the streamer doesn't need the PiP open. Live-match only
// (the live view gates on phase === "live"); harmless to leave on otherwise.
import { useSyncExternalStore } from "react";
import { Gift, Lock } from "lucide-react";
import { togglePromoDisplay, setPromoDisplay, isPromoDisplay, isPromoLocked, subscribePromoDisplay } from "@/lib/promo-display";
import { isStreamerMachine } from "@/lib/streamer-identity";

export function PromoToggleButton() {
  const on = useSyncExternalStore(subscribePromoDisplay, isPromoDisplay, () => false);
  const locked = useSyncExternalStore(subscribePromoDisplay, isPromoLocked, () => false);

  // The streamer's click PINS promos on (locks chat's !palpites out) and, going
  // back, releases the lock. A non-streamer's button is a plain local toggle.
  const onClick = () => {
    if (isStreamerMachine()) setPromoDisplay(!on, { lock: !on });
    else togglePromoDisplay();
  };

  return (
    <button
      type="button"
      onClick={onClick}
      title={
        on
          ? (locked ? "Promos travadas (o chat não volta pra palpites). Toque para voltar aos palpites." : "Voltar aos palpites")
          : "Mostrar as promoções da RB Store no lugar dos palpites (durante um jogo ao vivo)"
      }
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
      {locked ? <Lock size={13} /> : <Gift size={15} />}
      {on ? "◀ Palpites" : "Mostrar Promos"}
    </button>
  );
}
