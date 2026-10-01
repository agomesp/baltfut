"use client";

// ⚑ LOCAL-ONLY dev preview — toggle the test1/test2/test3 redesigns IN PLACE (the
// live-view content swaps to the new design with mocked data, app chrome intact),
// to compare before/after in localhost. NEVER COMMIT. Self-hides in prod builds.
import { type CSSProperties } from "react";
import { useDevTest, setDevTest, type DevTest } from "@/lib/dev-test";

const TESTS: { id: Exclude<DevTest, null>; label: string }[] = [
  { id: "test1", label: "palpite no chat (pré-jogo)" },
  { id: "test2", label: "pênalti no chat" },
  { id: "test3", label: "palpites ao vivo" },
];

// Mock-data overrides: force the SELECTED match into a state so every real screen
// is previewable on demand (renders the live PlacarStage with a mocked match).
const MOCKS: { id: Exclude<DevTest, null>; label: string }[] = [
  { id: "live", label: "jogo AO VIVO" },
  { id: "prepen", label: "pré-pênalti (110')" },
];

export function DevPopover() {
  const active = useDevTest();
  if (process.env.NODE_ENV === "production") return null;

  const panel: CSSProperties = { position: "fixed", top: 64, right: 14, zIndex: 99999, background: "rgba(8,12,9,0.96)", border: "1px solid rgba(200,255,45,0.45)", borderRadius: 11, padding: 11, width: 210, boxShadow: "0 10px 34px rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" };
  const btn = (on: boolean): CSSProperties => ({ textAlign: "left", fontFamily: "ui-monospace,Menlo,Consolas,monospace", fontSize: 11, padding: "7px 9px", borderRadius: 7, cursor: "pointer", border: on ? "1px solid #c8ff2d" : "1px solid rgba(255,255,255,0.12)", background: on ? "rgba(200,255,45,0.18)" : "rgba(255,255,255,0.03)", color: on ? "#eaffc0" : "#cfe3d6", lineHeight: 1.2 });

  return (
    <div style={panel}>
      <div style={{ fontFamily: "ui-monospace,monospace", fontSize: 9.5, letterSpacing: "0.1em", color: "#9ef01f", marginBottom: 7 }}>⚑ DEV PREVIEW · na tela AO VIVO</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {TESTS.map((t) => (
          <button key={t.id} onClick={() => setDevTest(active === t.id ? null : t.id)} style={btn(active === t.id)}>
            {active === t.id ? "● " : "○ "}<b>{t.id}</b> · {t.label}
          </button>
        ))}
        <div style={{ height: 1, background: "rgba(255,255,255,0.1)", margin: "3px 0" }} />
        <div style={{ fontFamily: "ui-monospace,monospace", fontSize: 8.5, letterSpacing: "0.08em", color: "#7d9a86" }}>DADOS MOCKADOS</div>
        {MOCKS.map((t) => (
          <button key={t.id} onClick={() => setDevTest(active === t.id ? null : t.id)} style={btn(active === t.id)}>
            {active === t.id ? "● " : "○ "}<b>{t.id}</b> · {t.label}
          </button>
        ))}
        <button onClick={() => setDevTest(null)} style={{ ...btn(false), marginTop: 3, opacity: active ? 1 : 0.5, color: "#ff9a9a", fontSize: 10 }}>✕ desligar (ver app real)</button>
      </div>
      <div style={{ marginTop: 7, fontFamily: "ui-monospace,monospace", fontSize: 8.5, color: "#6f8a78", lineHeight: 1.4 }}>abre na aba AO VIVO · usa os times do jogo selecionado</div>
    </div>
  );
}
