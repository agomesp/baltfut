"use client";

import { useEffect, useState } from "react";
import { Gift } from "lucide-react";
import { MONO } from "@/components/primitives";

/**
 * Small floating promo link (bottom-left). Stays a compact round icon, and every
 * ~22s "unrolls" — like a scroll opening — into a labelled button, then rolls
 * back. Hover also unrolls it. Links to the owner's promo-groups store.
 */
const HREF = "https://rbstore.net/";
const PERIOD_MS = 22_000;
const HOLD_MS = 5500;

export function PromoLink() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let hold: number | undefined;
    const expand = () => {
      setOpen(true);
      hold = window.setTimeout(() => setOpen(false), HOLD_MS);
    };
    const first = window.setTimeout(expand, 4000); // first peek shortly after load
    const id = window.setInterval(expand, PERIOD_MS);
    return () => {
      window.clearTimeout(first);
      if (hold) window.clearTimeout(hold);
      window.clearInterval(id);
    };
  }, []);

  return (
    <a
      href={HREF}
      target="_blank"
      rel="noopener noreferrer"
      title="Grupos de promoções — rbstore.net"
      onMouseEnter={() => setOpen(true)}
      style={{
        position: "fixed",
        bottom: 16,
        left: 14,
        zIndex: 60,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        height: 34,
        maxWidth: open ? 260 : 34,
        paddingLeft: 8,
        paddingRight: open ? 14 : 8,
        overflow: "hidden",
        whiteSpace: "nowrap",
        borderRadius: 999,
        textDecoration: "none",
        color: "#fff",
        background: "linear-gradient(90deg, #3b82f6, #6366f1)",
        boxShadow: "0 6px 22px rgba(0,0,0,0.4)",
        // the "scroll unrolling" — width eases open, then the label fades in
        transition: "max-width .6s cubic-bezier(.22,1,.36,1), padding .6s cubic-bezier(.22,1,.36,1)",
      }}
    >
      <Gift size={18} style={{ flex: "0 0 auto" }} />
      <span
        style={{
          fontFamily: MONO,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          opacity: open ? 1 : 0,
          transition: "opacity .4s ease .15s",
        }}
      >
        Grupos de promoções
      </span>
    </a>
  );
}
