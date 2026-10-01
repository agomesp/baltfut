"use client";

// LOCAL PREVIEW MOCK (/test2) — a stream-overlay concept for the PENALTY-WINNER
// phase: "the match is going to pens, type the winning team in chat". Mirrors
// /test but themed gold (the app's pen colour) and picks a team, not a score.
// Static mock; just to eyeball the UI.
import { useEffect, useState, type CSSProperties } from "react";
import { BRIC, SAIRA, JB, GOLD, GOLD_DEEP, DIM, DIM_2, FlagIcon } from "@/components/live/bf-ui";

const HOME = "BRA";
const HOME_NAME = "Brasil";
const AWAY = "JPN";
const AWAY_NAME = "Japão";

function useCountdown(fromSec: number) {
  const [s, setS] = useState(fromSec);
  useEffect(() => {
    const id = setInterval(() => setS((v) => (v > 0 ? v - 1 : fromSec)), 1000);
    return () => clearInterval(id);
  }, [fromSec]);
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

const card: CSSProperties = { borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" };

function ChatLine({ nick, pick, code, fresh }: { nick: string; pick: string; code: string; fresh?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 10, background: fresh ? "rgba(232,181,58,0.1)" : "rgba(255,255,255,0.03)", border: fresh ? "1px solid rgba(232,181,58,0.4)" : "1px solid rgba(255,255,255,0.05)" }}>
      <span style={{ flex: "none", width: 22, height: 22, borderRadius: 6, background: "#53fc18", color: "#0a0a0a", fontFamily: BRIC, fontWeight: 900, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>K</span>
      <span style={{ flex: 1, minWidth: 0, fontFamily: BRIC, fontWeight: 700, fontSize: 14, color: "#dfe7df", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nick}</span>
      <span style={{ flex: "none", display: "inline-flex", alignItems: "center", gap: 6, fontFamily: BRIC, fontWeight: 800, fontSize: 14, color: "#f3d27a" }}>
        <FlagIcon code={code} size={13} /> {pick}
      </span>
      <span style={{ flex: "none", fontFamily: JB, fontSize: 10, color: GOLD_DEEP, fontWeight: 700 }}>registrado ✓</span>
    </div>
  );
}

function PickFlag({ code, name }: { code: string; name: string }) {
  return (
    <button style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "16px 10px", borderRadius: 12, cursor: "pointer", background: "rgba(232,181,58,0.06)", border: "1px solid rgba(232,181,58,0.45)", color: "#f3d27a" }}>
      <FlagIcon code={code} size={34} />
      <span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: 17 }}>{code}</span>
      <span style={{ fontFamily: JB, fontSize: 9.5, color: DIM, letterSpacing: "0.04em" }}>{name}</span>
    </button>
  );
}

export default function TestPenChatPalpite() {
  const startsIn = useCountdown(58);
  useEffect(() => {
    const el = document.documentElement;
    const prev = el.getAttribute("data-view");
    el.setAttribute("data-view", "live");
    return () => { if (prev) el.setAttribute("data-view", prev); else el.removeAttribute("data-view"); };
  }, []);

  return (
    <main style={{ minHeight: "100vh", background: "radial-gradient(1200px 600px at 50% -10%, rgba(232,181,58,0.08), transparent), linear-gradient(180deg, #140f07, #0a0705)", color: "#e9ece8", padding: "26px clamp(16px,4vw,56px)" }}>
      <style>{"@keyframes blink{0%,49%{opacity:1}50%,100%{opacity:0}}@keyframes goldpulse{0%,100%{box-shadow:0 0 0 0 rgba(232,181,58,0)}50%{box-shadow:0 0 38px -6px rgba(232,181,58,0.5)}}@keyframes sirena{0%,100%{opacity:.55}50%{opacity:1}}"}</style>

      {/* header strip — pens are imminent */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
        <span style={{ fontFamily: JB, fontSize: 12, letterSpacing: "0.14em", color: GOLD }}>{"// PÊNALTIS"}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 9, fontFamily: JB, fontSize: 12, color: "#ffe6b0", background: "rgba(232,181,58,0.14)", border: "1px solid rgba(232,181,58,0.5)", borderRadius: 999, padding: "6px 14px" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: GOLD, animation: "sirena 1s infinite" }} /> DECISÃO NOS PÊNALTIS · 1ª batida em <b style={{ fontFamily: SAIRA, fontSize: 14 }}>{startsIn}</b>
        </span>
      </div>

      {/* hero — the draw heading to pens */}
      <div style={{ ...card, display: "flex", alignItems: "center", justifyContent: "center", gap: "clamp(16px,4vw,40px)", padding: "16px 22px", marginBottom: 18, border: "1px solid rgba(232,181,58,0.22)", background: "linear-gradient(180deg, rgba(232,181,58,0.07), transparent)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: "clamp(22px,3vw,34px)", color: "#ffd24a" }}>{HOME}</span>
          <FlagIcon code={HOME} size={40} />
        </span>
        <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <span style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: 30, color: "#fff", lineHeight: 1 }}>1 <span style={{ color: "#42565b" }}>×</span> 1</span>
          <span style={{ fontFamily: JB, fontSize: 9, letterSpacing: "0.12em", color: GOLD_DEEP }}>→ PÊNALTIS</span>
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
          <FlagIcon code={AWAY} size={40} />
          <span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: "clamp(22px,3vw,34px)", color: "#7db3ff" }}>{AWAY}</span>
        </span>
      </div>

      {/* two columns: BIG chat announcement + manual pick */}
      <div style={{ display: "flex", gap: 18, alignItems: "stretch", flexWrap: "wrap" }}>
        {/* ===== the star: type the winner in chat ===== */}
        <div style={{ ...card, flex: "3 1 520px", padding: "clamp(20px,3vw,38px)", border: "1px solid rgba(232,181,58,0.5)", background: "linear-gradient(160deg, rgba(232,181,58,0.1), rgba(232,181,58,0.03) 60%, transparent)", animation: "goldpulse 3s ease-in-out infinite", display: "flex", flexDirection: "column", gap: 18 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 9, alignSelf: "flex-start", fontFamily: JB, fontSize: 12, letterSpacing: "0.08em", color: "#1a1206", background: GOLD, borderRadius: 999, padding: "5px 13px", fontWeight: 800 }}>
            <span>🥅</span> PÊNALTIS PELO CHAT DA KICK
          </span>

          <h1 style={{ margin: 0, fontFamily: BRIC, fontWeight: 800, fontSize: "clamp(32px,5.4vw,62px)", lineHeight: 0.98, letterSpacing: "-0.02em", color: "#fff" }}>
            QUEM VENCE<br />NOS <span style={{ color: GOLD }}>PÊNALTIS?</span>
          </h1>

          <div style={{ fontFamily: BRIC, fontSize: "clamp(15px,1.7vw,20px)", color: "#e3d8c2", lineHeight: 1.45, maxWidth: 640 }}>
            Digite o time no chat — <b style={{ color: "#fff" }}>{HOME}</b> ou <b style={{ color: "#fff" }}>{AWAY}</b> (sigla ou nome). Acertar o vencedor vale <b style={{ color: GOLD }}>+0,5</b> no ranking.
          </div>

          {/* mock chat input */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 12, background: "#130d06", border: "1px solid rgba(255,255,255,0.12)" }}>
            <span style={{ flex: "none", width: 28, height: 28, borderRadius: 7, background: "#53fc18", color: "#0a0a0a", fontFamily: BRIC, fontWeight: 900, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>K</span>
            <span style={{ flex: 1, fontFamily: BRIC, fontSize: 18, color: "#a3927a" }}>Mensagem… <span style={{ color: "#fff", fontWeight: 800 }}>{HOME}</span><span style={{ display: "inline-block", width: 2, height: 20, background: GOLD, marginLeft: 3, verticalAlign: "-4px", animation: "blink 1s step-end infinite" }} /></span>
            <span style={{ flex: "none", fontFamily: JB, fontSize: 11, color: DIM, letterSpacing: "0.06em" }}>ENVIAR ↵</span>
          </div>

          {/* live feed of registered pen picks */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontFamily: JB, fontSize: 10, letterSpacing: "0.1em", color: DIM_2 }}>CHEGANDO DO CHAT</span>
            <ChatLine nick="ana_gol" pick={HOME} code={HOME} fresh />
            <ChatLine nick="pedrinho99" pick={AWAY} code={AWAY} />
            <ChatLine nick="rafaa" pick={HOME} code={HOME} />
          </div>

          <span style={{ fontFamily: JB, fontSize: 11.5, color: GOLD_DEEP, letterSpacing: "0.02em" }}>
            ✦ fecha quando a 1ª penalidade for batida · escolha agora
          </span>
        </div>

        {/* ===== manual pick ===== */}
        <div style={{ ...card, flex: "1 1 280px", padding: "20px 20px 22px", border: "1px solid rgba(232,181,58,0.22)", display: "flex", flexDirection: "column", gap: 14 }}>
          <span style={{ fontFamily: JB, fontSize: 12, letterSpacing: "0.1em", color: GOLD }}>{"// OU ESCOLHA AQUI"}</span>
          <span style={{ fontFamily: JB, fontSize: 9, letterSpacing: "0.06em", color: "#caa94a", textAlign: "center" }}>SE FOR AOS PÊNALTIS, QUEM VENCE? <span style={{ color: DIM_2 }}>(vale 0,5)</span></span>
          <div style={{ display: "flex", gap: 10 }}>
            <PickFlag code={HOME} name={HOME_NAME} />
            <PickFlag code={AWAY} name={AWAY_NAME} />
          </div>
          <span style={{ fontFamily: JB, fontSize: 9.5, color: DIM_2, textAlign: "center", letterSpacing: "0.04em" }}>toque na bandeira — salva na hora</span>

          {/* mini how-it-works */}
          <div style={{ marginTop: 4, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", flexDirection: "column", gap: 9 }}>
            {[
              ["1", "Empatou no tempo normal → pênaltis"],
              ["2", `Digite o time (${HOME} / ${AWAY}) no chat`],
              ["3", "Acertou o vencedor? +0,5 no ranking"],
            ].map(([n, t]) => (
              <div key={n} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ flex: "none", width: 20, height: 20, borderRadius: 6, background: "rgba(232,181,58,0.16)", color: GOLD, fontFamily: SAIRA, fontWeight: 800, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>{n}</span>
                <span style={{ fontFamily: BRIC, fontSize: 12.5, color: "#cdc2ad" }}>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p style={{ marginTop: 22, fontFamily: JB, fontSize: 10, color: DIM_2, textAlign: "center", letterSpacing: "0.04em" }}>mock · /test2 · só para visualização</p>
    </main>
  );
}
