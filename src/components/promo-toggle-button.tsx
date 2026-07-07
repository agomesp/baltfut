"use client";

// A main-UI shortcut (next to the Modo Streamer button) to flip the live palpites
// area to the RB Store promo Spotlight and back — the same toggle the Modo Streamer
// PiP offers, surfaced so the streamer doesn't need the PiP open. Promos are LIVE-MATCH
// ONLY (the live view gates on phase === "live"), so with no live match the button is
// disabled and a hover tooltip explains why.
import { useEffect, useState, useSyncExternalStore } from "react";
import { Gift, Lock } from "lucide-react";
import { togglePromoDisplay, setPromoDisplay, isPromoDisplay, isPromoLocked, subscribePromoDisplay } from "@/lib/promo-display";
import { isStreamerMachine } from "@/lib/streamer-identity";
import { subscribeScoreboard } from "@/lib/scoreboard-source";

/** True while any match is live — mirrors the live view's promo gate (m.isLive). The
 *  scoreboard source hands a late subscriber its cached snapshot immediately. */
function useHasLiveMatch(): boolean {
  const [hasLive, setHasLive] = useState(false);
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    // DEV: page.tsx's ?mocklive flips a match live in its own state (not the shared
    // scoreboard source), so honor the same flag here to keep the button testable.
    // No-op in the production build (dead-code-eliminated).
    if (process.env.NODE_ENV !== "production" && new URLSearchParams(window.location.search).has("mocklive")) {
      setHasLive(true);
      return;
    }
    return subscribeScoreboard((matches) => setHasLive(matches.some((m) => m.isLive)));
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  return hasLive;
}

export function PromoToggleButton() {
  const on = useSyncExternalStore(subscribePromoDisplay, isPromoDisplay, () => false);
  const locked = useSyncExternalStore(subscribePromoDisplay, isPromoLocked, () => false);
  const hasLive = useHasLiveMatch();
  const [hover, setHover] = useState(false);
  const disabled = !hasLive;

  // The streamer's click PINS promos on (locks chat's !palpites out) and, going
  // back, releases the lock. A non-streamer's button is a plain local toggle. No-op
  // with no live match (nowhere for the promos to show).
  const onClick = () => {
    if (disabled) return;
    if (isStreamerMachine()) setPromoDisplay(!on, { lock: !on });
    else togglePromoDisplay();
  };

  return (
    <div
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {disabled && hover ? (
        <div
          role="tooltip"
          style={{
            position: "absolute",
            bottom: "calc(100% + 10px)",
            right: 0,
            width: 232,
            fontFamily: "var(--font-jb)",
            fontSize: 11,
            lineHeight: 1.5,
            letterSpacing: "0.02em",
            textTransform: "none",
            color: "#f3ead2",
            background: "rgba(18,26,20,0.97)",
            border: "1px solid rgba(255,206,58,0.4)",
            borderRadius: 10,
            padding: "9px 12px",
            boxShadow: "0 10px 30px -6px rgba(0,0,0,0.6)",
            zIndex: 100,
          }}
        >
          As promoções só aparecem durante um jogo ao vivo — disponível quando uma partida estiver rolando.
          {/* little caret pointing down at the button */}
          <span
            aria-hidden
            style={{ position: "absolute", top: "100%", right: 22, width: 10, height: 10, marginTop: -5, transform: "rotate(45deg)", background: "rgba(18,26,20,0.97)", borderRight: "1px solid rgba(255,206,58,0.4)", borderBottom: "1px solid rgba(255,206,58,0.4)" }}
          />
        </div>
      ) : null}
      <button
        type="button"
        onClick={onClick}
        aria-disabled={disabled}
        title={
          disabled
            ? undefined // the styled tooltip explains it (a real `disabled` btn wouldn't show a title anyway)
            : on
              ? (locked ? "Promos travadas (o chat não volta pra palpites). Toque para voltar aos palpites." : "Voltar aos palpites")
              : "Mostrar as promoções da RB Store no lugar dos palpites"
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
          cursor: disabled ? "not-allowed" : "pointer",
          boxShadow: "0 6px 22px rgba(0,0,0,0.4)",
          background: on ? "rgba(255,206,58,0.24)" : "rgba(255,206,58,0.13)",
          color: "#ffe6a3",
          border: `1px solid rgba(255,206,58,${on ? 0.75 : 0.5})`,
          opacity: disabled ? 0.45 : 1,
        }}
      >
        {locked ? <Lock size={13} /> : <Gift size={15} />}
        {on ? "◀ Palpites" : "Mostrar Promos"}
      </button>
    </div>
  );
}
