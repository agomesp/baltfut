"use client";

// LOCAL PREVIEW MOCK (/test) — a stream-overlay concept for "palpite pelo chat":
// a big "type your score in chat" announcement next to the manual palpite form.
// Static mock data; not wired to anything. Just to eyeball the UI.
import { useEffect, useState, type CSSProperties } from "react";
import { BRIC, SAIRA, JB, LIME, LIME_DEEP, GOLD, GOLD_DEEP, DIM, DIM_2, FlagIcon, BfPulse } from "@/components/live/bf-ui";

const HOME = "BRA";
const AWAY = "JPN";

/** A fake countdown so the "fecha em" badge feels live. */
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

function ChatLine({ nick, score, fresh }: { nick: string; score: string; fresh?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 10, background: fresh ? "rgba(200,255,45,0.08)" : "rgba(255,255,255,0.03)", border: fresh ? "1px solid rgba(200,255,45,0.3)" : "1px solid rgba(255,255,255,0.05)" }}>
      <span style={{ flex: "none", width: 22, height: 22, borderRadius: 6, background: "#53fc18", color: "#0a0a0a", fontFamily: BRIC, fontWeight: 900, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>K</span>
      <span style={{ flex: 1, minWidth: 0, fontFamily: BRIC, fontWeight: 700, fontSize: 14, color: "#dfe7df", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nick}</span>
      <span style={{ flex: "none", fontFamily: SAIRA, fontWeight: 800, fontSize: 17, color: "#fff", letterSpacing: "0.04em" }}>{score}</span>
      <span style={{ flex: "none", fontFamily: JB, fontSize: 10, color: LIME, fontWeight: 700 }}>registrado ✓</span>
    </div>
  );
}

function MockStepper({ label, value }: { label: string; value: number }) {
  const btn: CSSProperties = { width: 34, height: 34, borderRadius: 9, border: "1px solid rgba(255,255,255,0.16)", background: "rgba(255,255,255,0.04)", color: "#cfe3d6", fontSize: 19, display: "flex", alignItems: "center", justifyContent: "center" };
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontFamily: BRIC, fontWeight: 800, fontSize: 15, color: "var(--bf-text,#e9ece8)", marginBottom: 7 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <span style={btn}>−</span>
        <span style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: 40, color: "#fff", width: 46, lineHeight: 0.8 }}>{value}</span>
        <span style={btn}>+</span>
      </div>
    </div>
  );
}

export default function TestChatPalpite() {
  const closesIn = useCountdown(4 * 60 + 32);
  // Match the live screen's dark pitch-green backdrop.
  useEffect(() => {
    const el = document.documentElement;
    const prev = el.getAttribute("data-view");
    el.setAttribute("data-view", "live");
    return () => { if (prev) el.setAttribute("data-view", prev); else el.removeAttribute("data-view"); };
  }, []);

  return (
    <main style={{ minHeight: "100vh", background: "radial-gradient(1200px 600px at 50% -10%, rgba(200,255,45,0.06), transparent), linear-gradient(180deg, #07140b, #050a07)", color: "#e9ece8", padding: "26px clamp(16px,4vw,56px)" }}>
      <style>{"@keyframes blink{0%,49%{opacity:1}50%,100%{opacity:0}}@keyframes glowpulse{0%,100%{box-shadow:0 0 0 0 rgba(200,255,45,0)}50%{box-shadow:0 0 34px -6px rgba(200,255,45,0.45)}}"}</style>

      {/* header strip */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
        <span style={{ fontFamily: JB, fontSize: 12, letterSpacing: "0.14em", color: GOLD }}>{"// PALPITES ABERTOS"}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 9, fontFamily: JB, fontSize: 12, color: "#cdeec0", background: "rgba(200,255,45,0.1)", border: "1px solid rgba(200,255,45,0.3)", borderRadius: 999, padding: "6px 14px" }}>
          <BfPulse /> PALPITES ABERTOS · fecha em <b style={{ fontFamily: SAIRA, fontSize: 14 }}>{closesIn}</b>
        </span>
      </div>

      {/* hero matchup */}
      <div style={{ ...card, display: "flex", alignItems: "center", justifyContent: "center", gap: "clamp(16px,4vw,44px)", padding: "16px 22px", marginBottom: 18, border: "1px solid rgba(255,179,71,0.16)", background: "linear-gradient(180deg, rgba(255,179,71,0.06), transparent)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: "clamp(22px,3vw,34px)", color: "#ffd24a" }}>{HOME}</span>
          <FlagIcon code={HOME} size={40} />
        </span>
        <span style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: 22, color: DIM_2 }}>VS</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
          <FlagIcon code={AWAY} size={40} />
          <span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: "clamp(22px,3vw,34px)", color: "#7db3ff" }}>{AWAY}</span>
        </span>
      </div>

      {/* two columns: BIG chat announcement + manual form */}
      <div style={{ display: "flex", gap: 18, alignItems: "stretch", flexWrap: "wrap" }}>
        {/* ===== the star: type your palpite in chat ===== */}
        <div style={{ ...card, flex: "3 1 520px", padding: "clamp(20px,3vw,38px)", border: "1px solid rgba(200,255,45,0.3)", background: "linear-gradient(160deg, rgba(200,255,45,0.07), rgba(83,252,24,0.03) 60%, transparent)", animation: "glowpulse 3.4s ease-in-out infinite", display: "flex", flexDirection: "column", gap: 18 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 9, alignSelf: "flex-start", fontFamily: JB, fontSize: 12, letterSpacing: "0.08em", color: "#0a0a0a", background: "#53fc18", borderRadius: 999, padding: "5px 13px", fontWeight: 800 }}>
            <span>▶</span> PALPITE PELO CHAT DA KICK
          </span>

          <h1 style={{ margin: 0, fontFamily: BRIC, fontWeight: 800, fontSize: "clamp(34px,6vw,68px)", lineHeight: 0.98, letterSpacing: "-0.02em", color: "#fff" }}>
            DIGITE <span style={{ color: LIME }}>2×1</span><br />NO CHAT
          </h1>

          <div style={{ fontFamily: BRIC, fontSize: "clamp(15px,1.7vw,20px)", color: "#cdd8cf", lineHeight: 1.45, maxWidth: 620 }}>
            Mande o placar no chat — <b style={{ color: "#fff" }}>1º número é o mandante</b> ({HOME}). Seu <b style={{ color: LIME }}>@nick</b> entra no Ranking dos Subs na hora.
          </div>

          {/* mock chat input */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 12, background: "#0c130d", border: "1px solid rgba(255,255,255,0.12)" }}>
            <span style={{ flex: "none", width: 28, height: 28, borderRadius: 7, background: "#53fc18", color: "#0a0a0a", fontFamily: BRIC, fontWeight: 900, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>K</span>
            <span style={{ flex: 1, fontFamily: BRIC, fontSize: 18, color: "#8aa394" }}>Mensagem… <span style={{ color: "#fff", fontWeight: 800 }}>{HOME} 2x1 {AWAY}</span><span style={{ display: "inline-block", width: 2, height: 20, background: LIME, marginLeft: 3, verticalAlign: "-4px", animation: "blink 1s step-end infinite" }} /></span>
            <span style={{ flex: "none", fontFamily: JB, fontSize: 11, color: DIM, letterSpacing: "0.06em" }}>ENVIAR ↵</span>
          </div>

          {/* live feed of registered chat palpites */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontFamily: JB, fontSize: 10, letterSpacing: "0.1em", color: DIM_2 }}>CHEGANDO DO CHAT</span>
            <ChatLine nick="ana_gol" score="2×1" fresh />
            <ChatLine nick="pedrinho99" score="0×0" />
            <ChatLine nick="rafaa" score="3×1" />
          </div>

          <span style={{ fontFamily: JB, fontSize: 11.5, color: GOLD_DEEP, letterSpacing: "0.02em" }}>
            ✦ mandou de novo? troca o placar · vale até o apito + 5min
          </span>
        </div>

        {/* ===== manual fallback ===== */}
        <div style={{ ...card, flex: "1 1 280px", padding: "20px 20px 22px", border: "1px solid rgba(200,255,45,0.16)", display: "flex", flexDirection: "column", gap: 14 }}>
          <span style={{ fontFamily: JB, fontSize: 12, letterSpacing: "0.1em", color: LIME }}>{"// OU ENVIE POR AQUI"}</span>
          <div>
            <div style={{ fontFamily: JB, fontSize: 10, letterSpacing: "0.08em", color: DIM, marginBottom: 6 }}>SEU NOME</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 13px", borderRadius: 10, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.14)" }}>
              <span style={{ fontFamily: BRIC, fontSize: 14, color: "#6f8a78" }}>digite seu @usuário</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18, padding: "4px 0" }}>
            <MockStepper label={HOME} value={2} />
            <span style={{ fontFamily: SAIRA, fontSize: 22, color: "#42565b", paddingTop: 24 }}>×</span>
            <MockStepper label={AWAY} value={1} />
          </div>
          <button style={{ fontFamily: BRIC, fontWeight: 800, fontSize: 15, padding: "13px", borderRadius: 12, border: "none", background: LIME, color: "#0f1f02", boxShadow: "0 0 26px -8px rgba(200,255,45,0.6)", cursor: "pointer" }}>ENVIAR PALPITE →</button>
          <span style={{ fontFamily: JB, fontSize: 9.5, color: DIM_2, textAlign: "center", letterSpacing: "0.04em" }}>1 palpite por pessoa · placar exato pontua no Ranking</span>

          {/* mini how-it-works */}
          <div style={{ marginTop: 4, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", flexDirection: "column", gap: 9 }}>
            {[
              ["1", "Digite o placar (ex: 2x1) no chat"],
              ["2", "Seu nick vira seu palpite"],
              ["3", "Acertou? sobe no Ranking dos Subs"],
            ].map(([n, t]) => (
              <div key={n} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ flex: "none", width: 20, height: 20, borderRadius: 6, background: "rgba(200,255,45,0.14)", color: LIME_DEEP, fontFamily: SAIRA, fontWeight: 800, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>{n}</span>
                <span style={{ fontFamily: BRIC, fontSize: 12.5, color: "#bcc8be" }}>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p style={{ marginTop: 22, fontFamily: JB, fontSize: 10, color: DIM_2, textAlign: "center", letterSpacing: "0.04em" }}>mock · /test · só para visualização</p>
    </main>
  );
}
