"use client";

// LOCAL PREVIEW MOCK (/test3) — a stream-overlay concept for a LIVE game that puts
// the PALPITES front-and-centre: who nails the current score ("cravando"), who can
// still win, who's out — so viewers see the stakes at a glance. Static mock.
import { useEffect, useState, type CSSProperties } from "react";
import { BRIC, SAIRA, JB, LIME, LIME_DEEP, GOLD, GOLD_DEEP, DIM, DIM_2, FlagIcon } from "@/components/live/bf-ui";

const HOME = "BRA";
const AWAY = "JPN";
const HS = 2;
const AS = 1;

// Mock palpites, classified vs the live 2×1 (mirrors classifyPrediction):
//  cravando = exact · pode = predHome>=HS && predAway>=AS · errou = otherwise.
const CRAVANDO = ["ana_gol", "joao13", "mari_v", "BielZ"];
const PODE = [
  { nick: "pedrinho99", s: "3×1" },
  { nick: "lucas_t", s: "2×2" },
  { nick: "bia.s", s: "3×2" },
  { nick: "rafaa", s: "4×1" },
  { nick: "thiago_p", s: "2×3" },
  { nick: "duda", s: "3×3" },
];
const ERROU = 23;

function useClock(fromMin: number) {
  const [t, setT] = useState(fromMin * 60);
  useEffect(() => {
    const id = setInterval(() => setT((v) => v + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return `${Math.floor(t / 60)}'`;
}

const card: CSSProperties = { borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" };

function ConsensusBar() {
  const home = 58, draw = 22, away = 20;
  const cell = (pct: number, label: string, color: string) => (
    <span style={{ color }}><b style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: 18 }}>{pct}%</b> <span style={{ fontFamily: JB, fontSize: 8.5, color: DIM }}>{label}</span></span>
  );
  return (
    <div style={{ ...card, padding: "12px 14px", border: "1px solid rgba(200,255,45,0.16)", background: "linear-gradient(120deg, rgba(200,255,45,0.06), transparent 70%)" }}>
      <div style={{ fontFamily: JB, fontSize: 9.5, letterSpacing: "0.12em", color: LIME, marginBottom: 9 }}>{"// A COMUNIDADE PALPITA"}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 7 }}>
        {cell(home, HOME, "#ffd24a")}{cell(draw, "EMP", "#c6d4cb")}{cell(away, AWAY, "#7db3ff")}
      </div>
      <div style={{ display: "flex", height: 6, borderRadius: 5, overflow: "hidden", gap: 2 }}>
        <div style={{ width: `${home}%`, background: "#ffd24a" }} /><div style={{ width: `${draw}%`, background: "#3a4a40" }} /><div style={{ width: `${away}%`, background: "#7db3ff" }} />
      </div>
    </div>
  );
}

export default function TestLivePalpites() {
  const clock = useClock(67);
  useEffect(() => {
    const el = document.documentElement;
    const prev = el.getAttribute("data-view");
    el.setAttribute("data-view", "live");
    return () => { if (prev) el.setAttribute("data-view", prev); else el.removeAttribute("data-view"); };
  }, []);

  return (
    <main style={{ minHeight: "100vh", background: "radial-gradient(1200px 600px at 50% -10%, rgba(200,255,45,0.05), transparent), linear-gradient(180deg, #07140b, #050a07)", color: "#e9ece8", padding: "26px clamp(16px,4vw,56px)" }}>
      <style>{"@keyframes lpulse{0%,100%{opacity:.5}50%{opacity:1}}@keyframes winglow{0%,100%{box-shadow:0 0 0 0 rgba(200,255,45,0)}50%{box-shadow:0 0 26px -8px rgba(200,255,45,0.55)}}"}</style>

      {/* header — live */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <span style={{ fontFamily: JB, fontSize: 12, letterSpacing: "0.14em", color: GOLD }}>{"// AO VIVO"}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 9, fontFamily: JB, fontSize: 12, color: "#ffd9d9", background: "rgba(255,77,77,0.12)", border: "1px solid rgba(255,77,77,0.4)", borderRadius: 999, padding: "6px 14px" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ff4d4d", animation: "lpulse 1.3s infinite" }} /> AO VIVO · <b style={{ fontFamily: SAIRA, fontSize: 14 }}>{clock}</b>
        </span>
      </div>

      {/* hero scoreboard */}
      <div style={{ ...card, display: "flex", alignItems: "center", justifyContent: "center", gap: "clamp(18px,4vw,52px)", padding: "18px 22px", marginBottom: 16, border: "1px solid rgba(200,255,45,0.14)", background: "linear-gradient(180deg, rgba(200,255,45,0.04), transparent)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 13 }}>
          <span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: "clamp(22px,3vw,34px)", color: "#ffd24a" }}>{HOME}</span>
          <FlagIcon code={HOME} size={44} />
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: "clamp(44px,7vw,78px)", color: "#fff", lineHeight: 0.74 }}>{HS}</span>
          <span style={{ width: 22, height: 5, borderRadius: 4, background: LIME, boxShadow: "0 0 14px rgba(200,255,45,0.5)" }} />
          <span style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: "clamp(44px,7vw,78px)", color: "#fff", lineHeight: 0.74 }}>{AS}</span>
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 13 }}>
          <FlagIcon code={AWAY} size={44} />
          <span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: "clamp(22px,3vw,34px)", color: "#7db3ff" }}>{AWAY}</span>
        </span>
      </div>

      {/* the star: live palpites */}
      <div style={{ display: "flex", gap: 16, alignItems: "stretch", flexWrap: "wrap" }}>
        <div style={{ ...card, flex: "3 1 560px", padding: "clamp(18px,2.4vw,30px)", border: "1px solid rgba(200,255,45,0.28)", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: "clamp(20px,2.6vw,30px)", color: "#fff" }}>PALPITES AO VIVO</span>
            <span style={{ fontFamily: JB, fontSize: 12, color: DIM }}>se acabar <b style={{ color: LIME, fontFamily: SAIRA, fontSize: 15 }}>{HS}×{AS}</b> agora…</span>
          </div>

          {/* CRAVANDO — the highlight */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: JB, fontSize: 11, letterSpacing: "0.08em", color: LIME_DEEP }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: LIME }} /> CRAVANDO O PLACAR · {CRAVANDO.length}
            </span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 10 }}>
              {CRAVANDO.map((nick) => (
                <div key={nick} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 13px", borderRadius: 12, background: "linear-gradient(135deg, rgba(200,255,45,0.16), rgba(200,255,45,0.04))", border: "1px solid rgba(200,255,45,0.5)", animation: "winglow 2.8s ease-in-out infinite" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: BRIC, fontWeight: 800, fontSize: 15, color: "#eaffd0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nick}</div>
                    <div style={{ fontFamily: JB, fontSize: 9, letterSpacing: "0.1em", color: LIME }}>CRAVOU {HS}×{AS}</div>
                  </div>
                  <span style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: 26, color: LIME, lineHeight: 1 }}>✓</span>
                </div>
              ))}
            </div>
          </div>

          {/* PODE GANHAR */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: JB, fontSize: 11, letterSpacing: "0.08em", color: GOLD_DEEP }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: GOLD }} /> AINDA PODE GANHAR · {PODE.length}
            </span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {PODE.map((p) => (
                <span key={p.nick} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 12px", borderRadius: 999, background: "rgba(232,181,58,0.08)", border: "1px solid rgba(232,181,58,0.32)" }}>
                  <span style={{ fontFamily: BRIC, fontWeight: 700, fontSize: 13, color: "#f0e0bf" }}>{p.nick}</span>
                  <span style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: 15, color: GOLD }}>{p.s}</span>
                </span>
              ))}
            </div>
          </div>

          {/* ERROU — dim count */}
          <span style={{ fontFamily: JB, fontSize: 11, color: DIM_2 }}>
            <b style={{ color: "#ff8f8f" }}>{ERROU}</b> já não alcançam o placar
          </span>
        </div>

        {/* side column — consensus + leader + IA */}
        <div style={{ flex: "1 1 260px", display: "flex", flexDirection: "column", gap: 14 }}>
          <ConsensusBar />
          <div style={{ ...card, padding: "14px 16px", border: "1px solid rgba(232,181,58,0.4)", background: "linear-gradient(120deg, rgba(232,181,58,0.16), rgba(232,181,58,0.02))" }}>
            <div style={{ fontFamily: JB, fontSize: 9, letterSpacing: "0.1em", color: GOLD_DEEP, marginBottom: 8 }}>LÍDER DO RANKING</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: 22, color: GOLD }}>1</span>
              <span style={{ flex: 1, fontFamily: BRIC, fontWeight: 800, fontSize: 16, color: "#f3d27a" }}>ChatGPT</span>
              <span style={{ fontFamily: SAIRA, fontWeight: 700, fontSize: 15 }}><span style={{ color: LIME_DEEP }}>6</span><span style={{ color: "#5c7560" }}>–28</span></span>
            </div>
          </div>
          <div style={{ ...card, padding: "14px 16px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 6 }}>
            <div style={{ fontFamily: JB, fontSize: 10, letterSpacing: "0.06em", color: GOLD }}>🤖 IA vs VOCÊ</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ textAlign: "center", flex: 1 }}>
                <div style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: 26, color: "#fff" }}>6</div>
                <div style={{ fontFamily: JB, fontSize: 8, color: DIM_2 }}>CHATGPT</div>
              </div>
              <span style={{ fontFamily: JB, fontSize: 10, color: DIM_2 }}>VS</span>
              <div style={{ textAlign: "center", flex: 1 }}>
                <div style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: 26, color: LIME }}>4</div>
                <div style={{ fontFamily: JB, fontSize: 8, color: DIM_2 }}>VOCÊ</div>
              </div>
            </div>
            <div style={{ fontFamily: JB, fontSize: 9, color: DIM, textAlign: "center" }}>você lidera nos últimos 3 🔥</div>
          </div>
        </div>
      </div>

      <p style={{ marginTop: 22, fontFamily: JB, fontSize: 10, color: DIM_2, textAlign: "center", letterSpacing: "0.04em" }}>mock · /test3 · só para visualização</p>
    </main>
  );
}
