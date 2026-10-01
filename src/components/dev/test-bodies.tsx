"use client";

// ⚑ LOCAL-ONLY (do not commit) — the test1/test2/test3 redesign BODIES, extracted
// so they can drop into the live-view content slot (in-page, app chrome around them)
// AND into the standalone /test* routes. Takes the real home/away codes; the chat
// feed / counters stay mocked (illustrative of the proposed feature).
import { useEffect, useState, type CSSProperties } from "react";
import { BRIC, SAIRA, JB, LIME, LIME_DEEP, GOLD, GOLD_DEEP, DIM, DIM_2, FlagIcon, BfPulse } from "@/components/live/bf-ui";
import { teamNamePt } from "@/lib/team-names";

const card: CSSProperties = { borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" };
const KEYS = "@keyframes blink{0%,49%{opacity:1}50%,100%{opacity:0}}@keyframes glowpulse{0%,100%{box-shadow:0 0 0 0 rgba(200,255,45,0)}50%{box-shadow:0 0 34px -6px rgba(200,255,45,0.45)}}@keyframes goldpulse{0%,100%{box-shadow:0 0 0 0 rgba(232,181,58,0)}50%{box-shadow:0 0 38px -6px rgba(232,181,58,0.5)}}@keyframes sirena{0%,100%{opacity:.55}50%{opacity:1}}@keyframes lpulse{0%,100%{opacity:.5}50%{opacity:1}}@keyframes winglow{0%,100%{box-shadow:0 0 0 0 rgba(200,255,45,0)}50%{box-shadow:0 0 26px -8px rgba(200,255,45,0.55)}}";

function useCountdown(fromSec: number) {
  const [s, setS] = useState(fromSec);
  useEffect(() => {
    const id = setInterval(() => setS((v) => (v > 0 ? v - 1 : fromSec)), 1000);
    return () => clearInterval(id);
  }, [fromSec]);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
function useClock(fromMin: number) {
  const [t, setT] = useState(fromMin * 60);
  useEffect(() => { const id = setInterval(() => setT((v) => v + 1), 1000); return () => clearInterval(id); }, []);
  return `${Math.floor(t / 60)}'`;
}

const Wrap = ({ children }: { children: React.ReactNode }) => (
  <div style={{ color: "#e9ece8", padding: "2px 0 8px", overflow: "auto", flex: 1, minHeight: 0 }}>
    <style>{KEYS}</style>
    {children}
  </div>
);

// ─────────────────────────────────── TEST 1 ───────────────────────────────────
function ChatScore({ nick, score, fresh }: { nick: string; score: string; fresh?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 10, background: fresh ? "rgba(200,255,45,0.08)" : "rgba(255,255,255,0.03)", border: fresh ? "1px solid rgba(200,255,45,0.3)" : "1px solid rgba(255,255,255,0.05)" }}>
      <span style={{ flex: "none", width: 22, height: 22, borderRadius: 6, background: "#53fc18", color: "#0a0a0a", fontFamily: BRIC, fontWeight: 900, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>K</span>
      <span style={{ flex: 1, minWidth: 0, fontFamily: BRIC, fontWeight: 700, fontSize: 14, color: "#dfe7df", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nick}</span>
      <span style={{ flex: "none", fontFamily: SAIRA, fontWeight: 800, fontSize: 17, color: "#fff" }}>{score}</span>
      <span style={{ flex: "none", fontFamily: JB, fontSize: 10, color: LIME, fontWeight: 700 }}>registrado ✓</span>
    </div>
  );
}
function MockStepper({ label, value }: { label: string; value: number }) {
  const btn: CSSProperties = { width: 34, height: 34, borderRadius: 9, border: "1px solid rgba(255,255,255,0.16)", background: "rgba(255,255,255,0.04)", color: "#cfe3d6", fontSize: 19, display: "flex", alignItems: "center", justifyContent: "center" };
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontFamily: BRIC, fontWeight: 800, fontSize: 15, color: "#e9ece8", marginBottom: 7 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <span style={btn}>−</span>
        <span style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: 40, color: "#fff", width: 46, lineHeight: 0.8 }}>{value}</span>
        <span style={btn}>+</span>
      </div>
    </div>
  );
}

export function Test1Body({ home, away }: { home: string; away: string }) {
  const closesIn = useCountdown(4 * 60 + 32);
  return (
    <Wrap>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
        <span style={{ fontFamily: JB, fontSize: 12, letterSpacing: "0.14em", color: GOLD }}>{"// PALPITES ABERTOS"}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 9, fontFamily: JB, fontSize: 12, color: "#cdeec0", background: "rgba(200,255,45,0.1)", border: "1px solid rgba(200,255,45,0.3)", borderRadius: 999, padding: "6px 14px" }}>
          <BfPulse /> PALPITES ABERTOS · fecha em <b style={{ fontFamily: SAIRA, fontSize: 14 }}>{closesIn}</b>
        </span>
      </div>
      <div style={{ ...card, display: "flex", alignItems: "center", justifyContent: "center", gap: "clamp(16px,4vw,44px)", padding: "16px 22px", marginBottom: 16, border: "1px solid rgba(255,179,71,0.16)", background: "linear-gradient(180deg, rgba(255,179,71,0.06), transparent)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}><span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: "clamp(22px,3vw,34px)", color: "#ffd24a" }}>{home}</span><FlagIcon code={home} size={40} /></span>
        <span style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: 22, color: DIM_2 }}>VS</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}><FlagIcon code={away} size={40} /><span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: "clamp(22px,3vw,34px)", color: "#7db3ff" }}>{away}</span></span>
      </div>
      <div style={{ display: "flex", gap: 18, alignItems: "stretch", flexWrap: "wrap" }}>
        <div style={{ ...card, flex: "3 1 520px", padding: "clamp(18px,2.6vw,32px)", border: "1px solid rgba(200,255,45,0.3)", background: "linear-gradient(160deg, rgba(200,255,45,0.07), rgba(83,252,24,0.03) 60%, transparent)", animation: "glowpulse 3.4s ease-in-out infinite", display: "flex", flexDirection: "column", gap: 16 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 9, alignSelf: "flex-start", fontFamily: JB, fontSize: 12, letterSpacing: "0.08em", color: "#0a0a0a", background: "#53fc18", borderRadius: 999, padding: "5px 13px", fontWeight: 800 }}>▶ PALPITE PELO CHAT DA KICK</span>
          <h1 style={{ margin: 0, fontFamily: BRIC, fontWeight: 800, fontSize: "clamp(30px,5vw,58px)", lineHeight: 0.98, letterSpacing: "-0.02em", color: "#fff" }}>DIGITE <span style={{ color: LIME }}>2×1</span><br />NO CHAT</h1>
          <div style={{ fontFamily: BRIC, fontSize: "clamp(14px,1.6vw,19px)", color: "#cdd8cf", lineHeight: 1.45, maxWidth: 620 }}>Mande o placar no chat — <b style={{ color: "#fff" }}>1º número é o mandante</b> ({home}). Seu <b style={{ color: LIME }}>@nick</b> entra no Ranking dos Subs na hora.</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderRadius: 12, background: "#0c130d", border: "1px solid rgba(255,255,255,0.12)" }}>
            <span style={{ flex: "none", width: 28, height: 28, borderRadius: 7, background: "#53fc18", color: "#0a0a0a", fontFamily: BRIC, fontWeight: 900, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>K</span>
            <span style={{ flex: 1, fontFamily: BRIC, fontSize: 17, color: "#8aa394" }}>Mensagem… <span style={{ color: "#fff", fontWeight: 800 }}>{home} 2x1 {away}</span><span style={{ display: "inline-block", width: 2, height: 19, background: LIME, marginLeft: 3, verticalAlign: "-4px", animation: "blink 1s step-end infinite" }} /></span>
            <span style={{ flex: "none", fontFamily: JB, fontSize: 11, color: DIM }}>ENVIAR ↵</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontFamily: JB, fontSize: 10, letterSpacing: "0.1em", color: DIM_2 }}>CHEGANDO DO CHAT</span>
            <ChatScore nick="ana_gol" score="2×1" fresh /><ChatScore nick="pedrinho99" score="0×0" /><ChatScore nick="rafaa" score="3×1" />
          </div>
          <span style={{ fontFamily: JB, fontSize: 11.5, color: GOLD_DEEP }}>✦ mandou de novo? troca o placar · vale até o apito + 5min</span>
        </div>
        <div style={{ ...card, flex: "1 1 280px", padding: "18px 20px 20px", border: "1px solid rgba(200,255,45,0.16)", display: "flex", flexDirection: "column", gap: 13 }}>
          <span style={{ fontFamily: JB, fontSize: 12, letterSpacing: "0.1em", color: LIME }}>{"// OU ENVIE POR AQUI"}</span>
          <div>
            <div style={{ fontFamily: JB, fontSize: 10, letterSpacing: "0.08em", color: DIM, marginBottom: 6 }}>SEU NOME</div>
            <div style={{ padding: "9px 13px", borderRadius: 10, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.14)" }}><span style={{ fontFamily: BRIC, fontSize: 14, color: "#6f8a78" }}>digite seu @usuário</span></div>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18, padding: "4px 0" }}>
            <MockStepper label={home} value={2} /><span style={{ fontFamily: SAIRA, fontSize: 22, color: "#42565b", paddingTop: 24 }}>×</span><MockStepper label={away} value={1} />
          </div>
          <button style={{ fontFamily: BRIC, fontWeight: 800, fontSize: 15, padding: "13px", borderRadius: 12, border: "none", background: LIME, color: "#0f1f02", boxShadow: "0 0 26px -8px rgba(200,255,45,0.6)", cursor: "pointer" }}>ENVIAR PALPITE →</button>
          <div style={{ marginTop: 2, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", flexDirection: "column", gap: 9 }}>
            {[["1", "Digite o placar (ex: 2x1) no chat"], ["2", "Seu nick vira seu palpite"], ["3", "Acertou? sobe no Ranking dos Subs"]].map(([n, t]) => (
              <div key={n} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ flex: "none", width: 20, height: 20, borderRadius: 6, background: "rgba(200,255,45,0.14)", color: LIME_DEEP, fontFamily: SAIRA, fontWeight: 800, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>{n}</span>
                <span style={{ fontFamily: BRIC, fontSize: 12.5, color: "#bcc8be" }}>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Wrap>
  );
}

// ─────────────────────────────────── TEST 2 ───────────────────────────────────
function ChatPick({ nick, code, fresh }: { nick: string; code: string; fresh?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 10, background: fresh ? "rgba(232,181,58,0.1)" : "rgba(255,255,255,0.03)", border: fresh ? "1px solid rgba(232,181,58,0.4)" : "1px solid rgba(255,255,255,0.05)" }}>
      <span style={{ flex: "none", width: 22, height: 22, borderRadius: 6, background: "#53fc18", color: "#0a0a0a", fontFamily: BRIC, fontWeight: 900, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>K</span>
      <span style={{ flex: 1, minWidth: 0, fontFamily: BRIC, fontWeight: 700, fontSize: 14, color: "#dfe7df", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nick}</span>
      <span style={{ flex: "none", display: "inline-flex", alignItems: "center", gap: 6, fontFamily: BRIC, fontWeight: 800, fontSize: 14, color: "#f3d27a" }}><FlagIcon code={code} size={13} /> {code}</span>
      <span style={{ flex: "none", fontFamily: JB, fontSize: 10, color: GOLD_DEEP, fontWeight: 700 }}>registrado ✓</span>
    </div>
  );
}
function PickFlag({ code }: { code: string }) {
  return (
    <button style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "16px 10px", borderRadius: 12, cursor: "pointer", background: "rgba(232,181,58,0.06)", border: "1px solid rgba(232,181,58,0.45)", color: "#f3d27a" }}>
      <FlagIcon code={code} size={34} /><span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: 17 }}>{code}</span>
      <span style={{ fontFamily: JB, fontSize: 9.5, color: DIM }}>{teamNamePt(code, code)}</span>
    </button>
  );
}

export function Test2Body({ home, away }: { home: string; away: string }) {
  const startsIn = useCountdown(58);
  return (
    <Wrap>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
        <span style={{ fontFamily: JB, fontSize: 12, letterSpacing: "0.14em", color: GOLD }}>{"// PÊNALTIS"}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 9, fontFamily: JB, fontSize: 12, color: "#ffe6b0", background: "rgba(232,181,58,0.14)", border: "1px solid rgba(232,181,58,0.5)", borderRadius: 999, padding: "6px 14px" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: GOLD, animation: "sirena 1s infinite" }} /> DECISÃO NOS PÊNALTIS · 1ª batida em <b style={{ fontFamily: SAIRA, fontSize: 14 }}>{startsIn}</b>
        </span>
      </div>
      <div style={{ ...card, display: "flex", alignItems: "center", justifyContent: "center", gap: "clamp(16px,4vw,40px)", padding: "16px 22px", marginBottom: 16, border: "1px solid rgba(232,181,58,0.22)", background: "linear-gradient(180deg, rgba(232,181,58,0.07), transparent)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}><span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: "clamp(22px,3vw,34px)", color: "#ffd24a" }}>{home}</span><FlagIcon code={home} size={40} /></span>
        <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}><span style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: 30, color: "#fff", lineHeight: 1 }}>1 <span style={{ color: "#42565b" }}>×</span> 1</span><span style={{ fontFamily: JB, fontSize: 9, letterSpacing: "0.12em", color: GOLD_DEEP }}>→ PÊNALTIS</span></span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}><FlagIcon code={away} size={40} /><span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: "clamp(22px,3vw,34px)", color: "#7db3ff" }}>{away}</span></span>
      </div>
      <div style={{ display: "flex", gap: 18, alignItems: "stretch", flexWrap: "wrap" }}>
        <div style={{ ...card, flex: "3 1 520px", padding: "clamp(18px,2.6vw,32px)", border: "1px solid rgba(232,181,58,0.5)", background: "linear-gradient(160deg, rgba(232,181,58,0.1), rgba(232,181,58,0.03) 60%, transparent)", animation: "goldpulse 3s ease-in-out infinite", display: "flex", flexDirection: "column", gap: 16 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 9, alignSelf: "flex-start", fontFamily: JB, fontSize: 12, letterSpacing: "0.08em", color: "#1a1206", background: GOLD, borderRadius: 999, padding: "5px 13px", fontWeight: 800 }}>🥅 PÊNALTIS PELO CHAT DA KICK</span>
          <h1 style={{ margin: 0, fontFamily: BRIC, fontWeight: 800, fontSize: "clamp(28px,4.6vw,54px)", lineHeight: 0.98, letterSpacing: "-0.02em", color: "#fff" }}>QUEM VENCE<br />NOS <span style={{ color: GOLD }}>PÊNALTIS?</span></h1>
          <div style={{ fontFamily: BRIC, fontSize: "clamp(14px,1.6vw,19px)", color: "#e3d8c2", lineHeight: 1.45, maxWidth: 640 }}>Digite o time no chat — <b style={{ color: "#fff" }}>{home}</b> ou <b style={{ color: "#fff" }}>{away}</b> (sigla ou nome). Acertar o vencedor vale <b style={{ color: GOLD }}>+0,5</b> no ranking.</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderRadius: 12, background: "#130d06", border: "1px solid rgba(255,255,255,0.12)" }}>
            <span style={{ flex: "none", width: 28, height: 28, borderRadius: 7, background: "#53fc18", color: "#0a0a0a", fontFamily: BRIC, fontWeight: 900, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>K</span>
            <span style={{ flex: 1, fontFamily: BRIC, fontSize: 17, color: "#a3927a" }}>Mensagem… <span style={{ color: "#fff", fontWeight: 800 }}>{home}</span><span style={{ display: "inline-block", width: 2, height: 19, background: GOLD, marginLeft: 3, verticalAlign: "-4px", animation: "blink 1s step-end infinite" }} /></span>
            <span style={{ flex: "none", fontFamily: JB, fontSize: 11, color: DIM }}>ENVIAR ↵</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontFamily: JB, fontSize: 10, letterSpacing: "0.1em", color: DIM_2 }}>CHEGANDO DO CHAT</span>
            <ChatPick nick="ana_gol" code={home} fresh /><ChatPick nick="pedrinho99" code={away} /><ChatPick nick="rafaa" code={home} />
          </div>
          <span style={{ fontFamily: JB, fontSize: 11.5, color: GOLD_DEEP }}>✦ fecha quando a 1ª penalidade for batida · escolha agora</span>
        </div>
        <div style={{ ...card, flex: "1 1 280px", padding: "18px 20px 20px", border: "1px solid rgba(232,181,58,0.22)", display: "flex", flexDirection: "column", gap: 13 }}>
          <span style={{ fontFamily: JB, fontSize: 12, letterSpacing: "0.1em", color: GOLD }}>{"// OU ESCOLHA AQUI"}</span>
          <span style={{ fontFamily: JB, fontSize: 9, letterSpacing: "0.06em", color: "#caa94a", textAlign: "center" }}>SE FOR AOS PÊNALTIS, QUEM VENCE? <span style={{ color: DIM_2 }}>(vale 0,5)</span></span>
          <div style={{ display: "flex", gap: 10 }}><PickFlag code={home} /><PickFlag code={away} /></div>
          <span style={{ fontFamily: JB, fontSize: 9.5, color: DIM_2, textAlign: "center" }}>toque na bandeira — salva na hora</span>
          <div style={{ marginTop: 2, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", flexDirection: "column", gap: 9 }}>
            {[["1", "Empatou no tempo normal → pênaltis"], ["2", `Digite o time (${home} / ${away}) no chat`], ["3", "Acertou o vencedor? +0,5 no ranking"]].map(([n, t]) => (
              <div key={n} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ flex: "none", width: 20, height: 20, borderRadius: 6, background: "rgba(232,181,58,0.16)", color: GOLD, fontFamily: SAIRA, fontWeight: 800, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>{n}</span>
                <span style={{ fontFamily: BRIC, fontSize: 12.5, color: "#cdc2ad" }}>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Wrap>
  );
}

// ─────────────────────────────────── TEST 3 ───────────────────────────────────
const CRAVANDO = ["ana_gol", "joao13", "mari_v", "BielZ"];
const PODE = [{ nick: "pedrinho99", s: "3×1" }, { nick: "lucas_t", s: "2×2" }, { nick: "bia.s", s: "3×2" }, { nick: "rafaa", s: "4×1" }, { nick: "thiago_p", s: "2×3" }, { nick: "duda", s: "3×3" }];

export function Test3Body({ home, away }: { home: string; away: string }) {
  const clock = useClock(67);
  const HS = 2, AS = 1;
  return (
    <Wrap>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
        <span style={{ fontFamily: JB, fontSize: 12, letterSpacing: "0.14em", color: GOLD }}>{"// AO VIVO"}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 9, fontFamily: JB, fontSize: 12, color: "#ffd9d9", background: "rgba(255,77,77,0.12)", border: "1px solid rgba(255,77,77,0.4)", borderRadius: 999, padding: "6px 14px" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ff4d4d", animation: "lpulse 1.3s infinite" }} /> AO VIVO · <b style={{ fontFamily: SAIRA, fontSize: 14 }}>{clock}</b>
        </span>
      </div>
      <div style={{ ...card, display: "flex", alignItems: "center", justifyContent: "center", gap: "clamp(18px,4vw,52px)", padding: "16px 22px", marginBottom: 14, border: "1px solid rgba(200,255,45,0.14)", background: "linear-gradient(180deg, rgba(200,255,45,0.04), transparent)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 13 }}><span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: "clamp(22px,3vw,34px)", color: "#ffd24a" }}>{home}</span><FlagIcon code={home} size={44} /></span>
        <span style={{ display: "flex", alignItems: "center", gap: 14 }}><span style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: "clamp(40px,6vw,70px)", color: "#fff", lineHeight: 0.74 }}>{HS}</span><span style={{ width: 22, height: 5, borderRadius: 4, background: LIME, boxShadow: "0 0 14px rgba(200,255,45,0.5)" }} /><span style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: "clamp(40px,6vw,70px)", color: "#fff", lineHeight: 0.74 }}>{AS}</span></span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 13 }}><FlagIcon code={away} size={44} /><span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: "clamp(22px,3vw,34px)", color: "#7db3ff" }}>{away}</span></span>
      </div>
      <div style={{ display: "flex", gap: 16, alignItems: "stretch", flexWrap: "wrap" }}>
        <div style={{ ...card, flex: "3 1 560px", padding: "clamp(16px,2.2vw,28px)", border: "1px solid rgba(200,255,45,0.28)", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: "clamp(20px,2.6vw,30px)", color: "#fff" }}>PALPITES AO VIVO</span>
            <span style={{ fontFamily: JB, fontSize: 12, color: DIM }}>se acabar <b style={{ color: LIME, fontFamily: SAIRA, fontSize: 15 }}>{HS}×{AS}</b> agora…</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: JB, fontSize: 11, letterSpacing: "0.08em", color: LIME_DEEP }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: LIME }} /> CRAVANDO O PLACAR · {CRAVANDO.length}</span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 10 }}>
              {CRAVANDO.map((nick) => (
                <div key={nick} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 13px", borderRadius: 12, background: "linear-gradient(135deg, rgba(200,255,45,0.16), rgba(200,255,45,0.04))", border: "1px solid rgba(200,255,45,0.5)", animation: "winglow 2.8s ease-in-out infinite" }}>
                  <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontFamily: BRIC, fontWeight: 800, fontSize: 15, color: "#eaffd0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nick}</div><div style={{ fontFamily: JB, fontSize: 9, letterSpacing: "0.1em", color: LIME }}>CRAVOU {HS}×{AS}</div></div>
                  <span style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: 26, color: LIME, lineHeight: 1 }}>✓</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: JB, fontSize: 11, letterSpacing: "0.08em", color: GOLD_DEEP }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: GOLD }} /> AINDA PODE GANHAR · {PODE.length}</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {PODE.map((p) => (
                <span key={p.nick} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 12px", borderRadius: 999, background: "rgba(232,181,58,0.08)", border: "1px solid rgba(232,181,58,0.32)" }}>
                  <span style={{ fontFamily: BRIC, fontWeight: 700, fontSize: 13, color: "#f0e0bf" }}>{p.nick}</span><span style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: 15, color: GOLD }}>{p.s}</span>
                </span>
              ))}
            </div>
          </div>
          <span style={{ fontFamily: JB, fontSize: 11, color: DIM_2 }}><b style={{ color: "#ff8f8f" }}>23</b> já não alcançam o placar</span>
        </div>
        <div style={{ flex: "1 1 260px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ ...card, padding: "12px 14px", border: "1px solid rgba(200,255,45,0.16)", background: "linear-gradient(120deg, rgba(200,255,45,0.06), transparent 70%)" }}>
            <div style={{ fontFamily: JB, fontSize: 9.5, letterSpacing: "0.12em", color: LIME, marginBottom: 9 }}>{"// A COMUNIDADE PALPITA"}</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 7 }}>
              <span style={{ color: "#ffd24a" }}><b style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: 18 }}>58%</b> <span style={{ fontFamily: JB, fontSize: 8.5, color: DIM }}>{home}</span></span>
              <span style={{ color: "#c6d4cb" }}><b style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: 18 }}>22%</b> <span style={{ fontFamily: JB, fontSize: 8.5, color: DIM }}>EMP</span></span>
              <span style={{ color: "#7db3ff" }}><b style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: 18 }}>20%</b> <span style={{ fontFamily: JB, fontSize: 8.5, color: DIM }}>{away}</span></span>
            </div>
            <div style={{ display: "flex", height: 6, borderRadius: 5, overflow: "hidden", gap: 2 }}><div style={{ width: "58%", background: "#ffd24a" }} /><div style={{ width: "22%", background: "#3a4a40" }} /><div style={{ width: "20%", background: "#7db3ff" }} /></div>
          </div>
          <div style={{ ...card, padding: "14px 16px", border: "1px solid rgba(232,181,58,0.4)", background: "linear-gradient(120deg, rgba(232,181,58,0.16), rgba(232,181,58,0.02))" }}>
            <div style={{ fontFamily: JB, fontSize: 9, letterSpacing: "0.1em", color: GOLD_DEEP, marginBottom: 8 }}>LÍDER DO RANKING</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: 22, color: GOLD }}>1</span><span style={{ flex: 1, fontFamily: BRIC, fontWeight: 800, fontSize: 16, color: "#f3d27a" }}>ChatGPT</span><span style={{ fontFamily: SAIRA, fontWeight: 700, fontSize: 15 }}><span style={{ color: LIME_DEEP }}>6</span><span style={{ color: "#5c7560" }}>–28</span></span></div>
          </div>
          <div style={{ ...card, padding: "14px 16px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 6 }}>
            <div style={{ fontFamily: JB, fontSize: 10, letterSpacing: "0.06em", color: GOLD }}>🤖 IA vs VOCÊ</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ textAlign: "center", flex: 1 }}><div style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: 26, color: "#fff" }}>6</div><div style={{ fontFamily: JB, fontSize: 8, color: DIM_2 }}>CHATGPT</div></div>
              <span style={{ fontFamily: JB, fontSize: 10, color: DIM_2 }}>VS</span>
              <div style={{ textAlign: "center", flex: 1 }}><div style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: 26, color: LIME }}>4</div><div style={{ fontFamily: JB, fontSize: 8, color: DIM_2 }}>VOCÊ</div></div>
            </div>
            <div style={{ fontFamily: JB, fontSize: 9, color: DIM, textAlign: "center" }}>você lidera nos últimos 3 🔥</div>
          </div>
        </div>
      </div>
    </Wrap>
  );
}
