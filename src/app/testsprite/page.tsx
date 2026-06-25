"use client";
import { useState, type CSSProperties, type ReactNode } from "react";
import { MONO, DISPLAY, cardStyle } from "@/components/primitives";
import { LpcSprite } from "@/components/lpc-sprite";
import { LAYERS, ANIMS, PRESETS, resolveUrls, type Anim, type Choice } from "@/data/lpc";
import { RiggedFootballer, KITS, ACTIONS, type Action } from "@/components/rigged-footballer";
import { PixelLabAnim } from "@/components/pixellab-anim";
import { GoalFoulCinematic, type CineMode } from "@/components/live/goal-foul-cinematic";
import { craqueForTeam, CRAQUE_CLIPS } from "@/data/craque-map";

// Phase-1 PixelLab animations (England craque). `frames: 0` = still rendering.
const PIXELLAB_ANIMS: { key: string; label: string; frames: number; fps: number }[] = [
  { key: "hero-idle", label: "Hero (breathing-idle)", frames: 4, fps: 5 },
  { key: "goal-kick", label: "Chute / gol", frames: 9, fps: 9 },
  { key: "celebrate", label: "Comemoração", frames: 9, fps: 10 },
  { key: "slide-foul", label: "Carrinho / falta", frames: 6, fps: 10 },
];

const DIRS = [
  { id: "s", label: "↓ Frente" },
  { id: "n", label: "↑ Costas" },
  { id: "w", label: "← Esq." },
  { id: "e", label: "→ Dir." },
];

const CHECKER: CSSProperties = {
  background: "repeating-conic-gradient(rgba(128,128,128,0.18) 0% 25%, transparent 0% 50%) 50% / 18px 18px",
  border: "1px solid var(--line)",
  borderRadius: 10,
  padding: 14,
};

const ASSET_BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
// PixelLab AI craque (1 standard generation, 8 directions, owned output). Local
// experiment assets under public/pixellab-assets/ (git-excluded).
const PIXELLAB_DIRS = ["south", "south-west", "west", "north-west", "north", "north-east", "east", "south-east"];
const PIXELLAB_BASE = `${ASSET_BASE}/pixellab-assets/england-craque-test`;
const pixelImg: CSSProperties = { imageRendering: "pixelated", width: 92, height: 92, objectFit: "contain" };

// Data-driven craque roster (one per kit color). null clip = not generated yet
// (the card shows the static south rotation instead). Hero pose faces south
// (viewer); kick + slide are south-east. Add a new craque = one row here.
const PB = `${ASSET_BASE}/pixellab-assets`;
type ClipRef = { key: string; frames: number; fps: number } | null;
interface RosterCraque { label: string; base: string; hero: ClipRef; kick: ClipRef; slide: ClipRef }
const CRAQUE_ROSTER: RosterCraque[] = [
  { label: "⬜ Branco", base: "england-craque-test", hero: { key: "hero-idle", frames: 4, fps: 5 }, kick: { key: "goal-kick", frames: 9, fps: 9 }, slide: { key: "slide-foul", frames: 6, fps: 10 } },
  { label: "🟨 Amarelo", base: "yellow-craque-test", hero: { key: "arms-crossed", frames: 5, fps: 5 }, kick: { key: "goal-kick", frames: 5, fps: 7 }, slide: { key: "slide-foul", frames: 6, fps: 8 } },
  { label: "🟥 Vermelho", base: "red-craque", hero: { key: "hero", frames: 5, fps: 5 }, kick: { key: "goal-kick", frames: 5, fps: 7 }, slide: { key: "slide-foul", frames: 6, fps: 8 } },
  { label: "🟦 Azul", base: "blue-craque", hero: { key: "hero", frames: 5, fps: 5 }, kick: { key: "goal-kick", frames: 5, fps: 7 }, slide: { key: "slide-foul", frames: 6, fps: 8 } },
  { label: "🟩 Verde", base: "green-craque", hero: { key: "hero", frames: 4, fps: 5 }, kick: { key: "goal-kick", frames: 5, fps: 7 }, slide: { key: "slide-foul", frames: 6, fps: 8 } },
  { label: "🟫 Bordô", base: "maroon-craque", hero: { key: "hero", frames: 4, fps: 5 }, kick: { key: "goal-kick", frames: 5, fps: 7 }, slide: { key: "slide-foul", frames: 6, fps: 8 } },
  { label: "🟧 Laranja", base: "orange-craque", hero: { key: "hero", frames: 4, fps: 5 }, kick: { key: "goal-kick", frames: 5, fps: 7 }, slide: { key: "slide-foul", frames: 6, fps: 8 } },
  { label: "🟦 Celeste", base: "celeste-craque", hero: { key: "hero", frames: 5, fps: 5 }, kick: { key: "goal-kick", frames: 5, fps: 7 }, slide: { key: "slide-foul", frames: 6, fps: 8 } },
];

// Escalação squad wall — 3 generic bodies (fair/tan/dark skin) shown grayscale,
// kit-color-agnostic so they reuse for every team. Static; anims deferred.
const SQUAD_WALL = ["squad-fair", "squad-tan", "squad-dark"];

function RosterTile({ base, clip, fallbackLabel }: { base: string; clip: ClipRef; fallbackLabel: string }) {
  return (
    <div style={{ ...CHECKER, padding: 8, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      {clip ? (
        <PixelLabAnim dir={`${PB}/${base}/anim/${clip.key}`} frames={clip.frames} size={92} scale={1.2} fps={clip.fps} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`${PB}/${base}/south.png`} alt="" style={{ imageRendering: "pixelated", width: 110, height: 110, objectFit: "contain" }} />
      )}
      <span style={{ fontFamily: MONO, fontSize: 9, color: "var(--ink-3)" }}>{fallbackLabel}</span>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderTop: "1px solid var(--line)", flexWrap: "wrap" }}>
      <span style={{ flex: "0 0 80px", fontFamily: MONO, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-3)" }}>{label}</span>
      {children}
    </div>
  );
}

function Chip({ active, onClick, children }: { active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: MONO,
        fontSize: 12,
        padding: "5px 11px",
        borderRadius: 999,
        cursor: "pointer",
        textTransform: "capitalize",
        background: active ? "var(--signal)" : "transparent",
        color: active ? "var(--signal-ink)" : "var(--ink-2)",
        border: `1px solid ${active ? "var(--signal)" : "var(--line-2)"}`,
      }}
    >
      {children}
    </button>
  );
}

const selectStyle: CSSProperties = { fontFamily: MONO, fontSize: 12, padding: "5px 8px", borderRadius: 8, border: "1px solid var(--line-2)" };

export default function TestSprite() {
  const [choices, setChoices] = useState<Record<string, Choice>>({
    body: { opt: 0 },
    legs: { opt: 0 },
    shirt: null,
    head: { opt: 0 },
    hair: { opt: 0 },
  });
  const [anim, setAnim] = useState<Anim>("walk");
  const [dir, setDir] = useState("s");
  const [fps, setFps] = useState(8);
  const [playing, setPlaying] = useState(true);
  const [act, setAct] = useState<Action>("kick");
  const [kitIdx, setKitIdx] = useState(0);
  // Goal/foul cinematic preview state. cineRun bumps to replay.
  const [cineRun, setCineRun] = useState(0);
  const [cineMode, setCineMode] = useState<CineMode>("goal");
  const [cineSide, setCineSide] = useState<"home" | "away">("home");
  const CINE_HOME = "BRA";
  const CINE_AWAY = "ARG";
  const fire = (mode: CineMode, side: "home" | "away") => {
    setCineMode(mode);
    setCineSide(side);
    setCineRun((n) => n + 1);
  };
  const cineCode = cineSide === "home" ? CINE_HOME : CINE_AWAY;
  const cineBase = craqueForTeam(cineCode) ?? "england-craque-test";
  const cineClip = cineMode === "goal" ? CRAQUE_CLIPS[cineBase].kick : CRAQUE_CLIPS[cineBase].slide;

  const urls = resolveUrls(choices, anim);
  const setLayer = (key: string, ch: Choice) => setChoices((c) => ({ ...c, [key]: ch }));

  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: "28px 20px 90px" }}>
      <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-3)" }}>Experimento local · não comitar</div>
      <h1 style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: 34, letterSpacing: "-0.02em", margin: "4px 0 6px", color: "var(--ink)" }}>LPC Sprite Lab</h1>
      <p style={{ fontSize: 14, color: "var(--ink-2)", maxWidth: 700, marginBottom: 22, lineHeight: 1.5 }}>
        Universal LPC Spritesheet — personagens genéricos montados por camadas (corpo · pernas · roupa · cabeça · cabelo) e animados. Troque tipos, variações e animações ao vivo.
      </p>

      {/* Goal/foul cinematic preview (AO VIVO hero). */}
      <section style={{ ...cardStyle, marginBottom: 24, padding: 18, border: "1px solid var(--signal)" }}>
        <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--signal-strong)", marginBottom: 4 }}>Cinematic de gol / falta — AO VIVO ({CINE_HOME} × {CINE_AWAY})</div>
        <p style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 14, maxWidth: 760, lineHeight: 1.5 }}>
          Times saem + placar some → o craque (ou genérico) entra no meio chutando/dando carrinho → bola/cartão vem do ângulo do espectador, encolhendo até o pé → impacto com tremor + pulso → personagem sai e o placar volta. Clique para disparar.
        </p>
        <div style={{ maxWidth: 620, margin: "0 auto 14px" }}>
          <GoalFoulCinematic runId={cineRun} mode={cineMode} side={cineSide} homeCode={CINE_HOME} awayCode={CINE_AWAY} scorerBase={cineBase} scorerClip={cineClip} homeScore={cineSide === "home" && cineMode === "goal" ? 1 : 0} awayScore={cineSide === "away" && cineMode === "goal" ? 1 : 0} />
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          <Chip active={false} onClick={() => fire("goal", "home")}>⚽ Gol {CINE_HOME}</Chip>
          <Chip active={false} onClick={() => fire("goal", "away")}>⚽ Gol {CINE_AWAY}</Chip>
          <Chip active={false} onClick={() => fire("yellow", "home")}>🟨 Falta {CINE_HOME}</Chip>
          <Chip active={false} onClick={() => fire("red", "away")}>🟥 Vermelho {CINE_AWAY}</Chip>
        </div>
      </section>

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
        {/* Preview + live controls */}
        <section style={{ ...cardStyle, flex: "1 1 380px", minWidth: 330, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
            <div style={CHECKER}>
              <LpcSprite urls={urls} dir={dir} fps={fps} playing={playing} scale={4} />
            </div>
          </div>

          <Row label="Animação">
            {ANIMS.map((a) => (
              <Chip key={a} active={anim === a} onClick={() => setAnim(a)}>{a}</Chip>
            ))}
          </Row>
          <Row label="Direção">
            {DIRS.map((d) => (
              <Chip key={d.id} active={dir === d.id} onClick={() => setDir(d.id)}>{d.label}</Chip>
            ))}
          </Row>
          <Row label="Velocidade">
            <input type="range" min={2} max={16} value={fps} onChange={(e) => setFps(Number(e.target.value))} />
            <span style={{ fontFamily: MONO, fontSize: 12, color: "var(--ink-2)" }}>{fps} fps</span>
            <Chip active={playing} onClick={() => setPlaying((p) => !p)}>{playing ? "⏸ pausar" : "▶ tocar"}</Chip>
          </Row>

          {LAYERS.map((layer) => {
            const ch = choices[layer.key];
            const opt = ch ? layer.options[ch.opt] : null;
            return (
              <Row key={layer.key} label={layer.label}>
                {layer.optional && (
                  <Chip active={!!ch} onClick={() => setLayer(layer.key, ch ? null : { opt: 0 })}>{ch ? "on" : "off"}</Chip>
                )}
                <select
                  disabled={!ch}
                  value={ch?.opt ?? 0}
                  onChange={(e) => {
                    const next = layer.options[Number(e.target.value)];
                    setLayer(layer.key, { opt: Number(e.target.value), color: next?.colors?.[0] });
                  }}
                  style={selectStyle}
                >
                  {layer.options.map((o, i) => (
                    <option key={i} value={i}>{o.label}</option>
                  ))}
                </select>
                {opt?.colors && ch && (
                  <select value={ch.color ?? opt.colors[0]} onChange={(e) => setLayer(layer.key, { opt: ch.opt, color: e.target.value })} style={selectStyle}>
                    {opt.colors.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                )}
              </Row>
            );
          })}
        </section>

        {/* Gallery: variations walking */}
        <section style={{ ...cardStyle, flex: "1 1 320px", minWidth: 300, padding: 18 }}>
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-3)", marginBottom: 14 }}>Elenco — variações andando</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {PRESETS.map((p) => (
              <div key={p.name} style={{ ...CHECKER, padding: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <LpcSprite urls={resolveUrls(p.choices, "walk")} dir="s" fps={8} scale={2} />
                <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--ink-2)" }}>{p.name}</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 14, lineHeight: 1.5 }}>
            Mesma engine do preview: cada card é um personagem diferente, montado por camadas e andando.
          </p>
        </section>
      </div>

      <section style={{ ...cardStyle, marginTop: 20, padding: 18 }}>
        <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-3)", marginBottom: 4 }}>SVG rig (paramétrico) — ações de futebol</div>
        <p style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 14, maxWidth: 700, lineHeight: 1.5 }}>
          Boneco vetorial genérico, articulado por juntas e animado por código — sem pixel art, sem semelhança real. Aqui dá pra criar <strong>qualquer</strong> ação: chute, comemoração, carrinho. Recolorível por time.
        </p>
        <div style={{ display: "flex", gap: 22, flexWrap: "wrap", alignItems: "center" }}>
          <div style={CHECKER}>
            <RiggedFootballer action={act} kit={KITS[kitIdx].kit} scale={1.7} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Row label="Ação">
              {ACTIONS.map((a) => (
                <Chip key={a} active={act === a} onClick={() => setAct(a)}>{a}</Chip>
              ))}
            </Row>
            <Row label="Kit">
              {KITS.map((kt, i) => (
                <Chip key={kt.name} active={kitIdx === i} onClick={() => setKitIdx(i)}>{kt.name}</Chip>
              ))}
            </Row>
          </div>
        </div>
      </section>

      <section style={{ ...cardStyle, marginTop: 20, padding: 18, border: "1px solid var(--signal)" }}>
        <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--signal-strong)", marginBottom: 4 }}>PixelLab (IA pixel art) — craque genérico · 8 direções</div>
        <p style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 16, maxWidth: 760, lineHeight: 1.5 }}>
          Pixel art 16-bit gerado por IA (1 geração padrão), jogador <strong>genérico</strong> sem semelhança real — saída <strong>nossa</strong> (licença comercial, sem permissão). Mesmo personagem consistente em 8 ângulos. Próximo passo possível: animar (chute/corrida) e tocar com a engine de frames.
        </p>
        {/* Hero-scale side view + the full 8-direction rotation row. */}
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ ...CHECKER, padding: 18 }}>
            <div style={{ fontFamily: MONO, fontSize: 10, color: "var(--ink-3)", marginBottom: 8 }}>vista lateral (craque)</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${PIXELLAB_BASE}/east.png`} alt="" style={{ imageRendering: "pixelated", width: 184, height: 184, objectFit: "contain", display: "block" }} />
          </div>
          <div style={{ ...CHECKER, flex: "1 1 300px" }}>
            <div style={{ fontFamily: MONO, fontSize: 10, color: "var(--ink-3)", marginBottom: 8 }}>8 direções (mesmo personagem)</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {PIXELLAB_DIRS.map((d) => (
                <div key={d} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`${PIXELLAB_BASE}/${d}.png`} alt={d} style={pixelImg} />
                  <span style={{ fontFamily: MONO, fontSize: 9, color: "var(--ink-3)" }}>{d}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Animations (Phase 1) — play the per-frame PixelLab clips. */}
        <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--signal-strong)", margin: "18px 0 8px" }}>Animações (ações de futebol)</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {PIXELLAB_ANIMS.map((a) => (
            <div key={a.key} style={{ ...CHECKER, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 150 }}>
              {a.frames > 0 ? (
                <PixelLabAnim dir={`${PIXELLAB_BASE}/anim/${a.key}`} frames={a.frames} scale={2} fps={a.fps} />
              ) : (
                <div style={{ width: 184, height: 184, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: 11, color: "var(--ink-3)", textAlign: "center" }}>
                  renderizando…
                </div>
              )}
              <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--ink-2)" }}>{a.label}</span>
            </div>
          ))}
        </div>

        {/* Craque roster — one card per kit color. hero=south, kick/slide=SE.
            null clips fall back to the static south rotation. */}
        <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--signal-strong)", margin: "20px 0 8px" }}>Craque roster (1 por cor) — hero · chute · carrinho</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {CRAQUE_ROSTER.map((c) => (
            <div key={c.base} style={{ ...cardStyle, padding: 12 }}>
              <div style={{ fontFamily: MONO, fontSize: 11, color: "var(--ink-2)", marginBottom: 8 }}>{c.label}</div>
              <div style={{ display: "flex", gap: 6 }}>
                <RosterTile base={c.base} clip={c.hero} fallbackLabel={c.hero ? "hero" : "base"} />
                <RosterTile base={c.base} clip={c.kick} fallbackLabel={c.kick ? "chute" : "—"} />
                <RosterTile base={c.base} clip={c.slide} fallbackLabel={c.slide ? "carrinho" : "—"} />
              </div>
            </div>
          ))}
        </div>

        {/* Escalação — 3 generic grayscale bodies, reused for every team. */}
        <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-3)", margin: "20px 0 8px" }}>Escalação — 3 corpos genéricos cinza (reusados p/ todos os times)</div>
        <div style={{ display: "flex", gap: 8 }}>
          {SQUAD_WALL.map((s) => (
            <div key={s} style={{ ...CHECKER, padding: 8 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${PB}/${s}/south.png`} alt="" style={{ imageRendering: "pixelated", width: 84, height: 84, objectFit: "contain", filter: "grayscale(1)", display: "block" }} />
            </div>
          ))}
        </div>
      </section>

      <p style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 24, lineHeight: 1.6 }}>
        Arte: <strong>Universal LPC Spritesheet</strong> (Liberated Pixel Cup) — bluecarrot16, JaidynReiman, ElizaWy, Johannes Sjölund (wulax), Stephen Challener (Redshrike) e outros. Licenças CC-BY-SA 3.0 / GPL 3.0 / OGA-BY 3.0. Assets locais em <code>public/lpc-assets/</code> (não versionados). Craque PixelLab em <code>public/pixellab-assets/</code> (não versionado).
      </p>
    </main>
  );
}
