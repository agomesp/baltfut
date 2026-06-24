"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PictureInPicture } from "lucide-react";
import { fetchScoreboard, FIFA_WORLD_DATE_RANGE, type Match } from "@/lib/espn";
import { getSupabaseClient } from "@/lib/supabase/client";
import { fetchVoteEntries, rankPredictions, type RankedPrediction } from "@/lib/votes";
import {
  clockOrder,
  esc,
  LAYOUT_SIZE,
  pickMatch,
  resolveLayout,
  type PipLayout,
} from "@/components/pip/resolve";

const POLL_MS = 20_000;

// Self-contained styles injected into the PiP window (which has no globals.css)
// AND into the page for the overlay fallback. Scoped under `.pipwrap` and keyed
// by [data-theme] so it never collides with the app and matches the live theme.
const PIP_CSS = `
.pipwrap[data-theme="dark"]{--bg:#16171a;--surface:#1d1e22;--ink:#ecede8;--ink-2:#9a9b95;--ink-3:#6a6b66;--line:#2a2b2e;--line-2:#3a3b40;--signal:#43b86a;--signal-strong:#62cb84;--rank:#facc15;--card-yellow:#f5c84a;--card-red:#e5484d;}
.pipwrap[data-theme="light"]{--bg:#ecede8;--surface:#f4f5f0;--ink:#1c1c1b;--ink-2:#5c5d57;--ink-3:#8a8b85;--line:#d8d9d2;--line-2:#c6c7bf;--signal:#2f9e44;--signal-strong:#1f7a36;--rank:#b7791f;--card-yellow:#e0a800;--card-red:#d3343a;}
.pipwrap{--mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;--sans:ui-sans-serif,system-ui,-apple-system,sans-serif;position:relative;background:var(--surface);color:var(--ink);border:1px solid var(--line-2);border-radius:12px;overflow:hidden;display:flex;flex-direction:column;font-family:var(--sans);}
.pipwrap *{box-sizing:border-box;}
.pipwrap .ctrl{position:absolute;top:5px;right:5px;z-index:4;}
.pipwrap .cyc{font-family:var(--mono);font-size:9px;letter-spacing:.04em;background:rgba(0,0,0,.5);color:var(--ink-2);border:1px solid var(--line-2);border-radius:999px;padding:3px 7px;cursor:pointer;white-space:nowrap;}
.pipwrap .cyc:hover{color:var(--ink);}
.pipwrap .body{flex:1 1 auto;padding:12px 14px;min-height:0;}
.pipwrap[data-layout="bar"] .body,.pipwrap[data-layout="wide"] .body{padding:0;}
.pipwrap .top{display:flex;align-items:center;justify-content:space-between;gap:8px;}
.pipwrap .live{font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--signal-strong);}
.pipwrap .meta{font-family:var(--mono);font-size:10px;color:var(--ink-3);}
.pipwrap .score{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:10px;margin:8px 0 4px;}
.pipwrap .team{font-size:22px;font-weight:600;letter-spacing:-.02em;}
.pipwrap .team.away{text-align:right;}
.pipwrap .num{font-size:24px;font-weight:600;white-space:nowrap;}
.pipwrap .feed{display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;margin-top:8px;border-top:1px solid var(--line);padding-top:8px;font-family:var(--mono);font-size:12px;}
.pipwrap .feed .away{text-align:right;}
.pipwrap .clk{color:var(--signal-strong);}
.pipwrap .chip{display:inline-block;width:8px;height:11px;border-radius:2px;vertical-align:-1px;}
.pipwrap .chip.yellow{background:var(--card-yellow);}
.pipwrap .chip.red{background:var(--card-red);}
.pipwrap .tag{font-family:var(--mono);font-size:9px;letter-spacing:.06em;text-transform:uppercase;padding:1px 5px;border-radius:999px;border:1px solid var(--line-2);color:var(--ink-3);}
.pipwrap .tag.win{color:var(--signal-strong);border-color:var(--signal);}
.pipwrap .tag.can{color:var(--rank);border-color:var(--rank);}
.pipwrap .ticker{overflow:hidden;width:100%;height:100%;display:flex;align-items:center;}
.pipwrap .track{display:inline-flex;align-items:center;gap:22px;white-space:nowrap;font-family:var(--mono);font-size:11px;animation:pipscroll 26s linear infinite;will-change:transform;padding-left:14px;}
.pipwrap .ticker:hover .track{animation-play-state:paused;}
@keyframes pipscroll{from{transform:translateX(0);}to{transform:translateX(-50%);}}
.pipwrap .ti{display:inline-flex;align-items:center;gap:6px;}
.pipwrap .ti .nm{color:var(--ink-2);}
.pipwrap .tlbl{font-family:var(--mono);font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3);padding-left:14px;flex:0 0 auto;}
.pipwrap .pl{display:flex;align-items:center;justify-content:space-between;gap:6px;font-size:12px;padding:3px 0;border-bottom:1px solid var(--line);}
.pipwrap .pl:last-child{border-bottom:0;}
.pipwrap .pl .nm{color:var(--ink-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.pipwrap .pl .pr{font-family:var(--mono);}
.pipwrap .bar-stack{display:flex;flex-direction:column;height:100%;}
.pipwrap .bar-score{flex:0 0 24px;display:flex;align-items:center;justify-content:center;gap:10px;font-family:var(--mono);padding:0 16px;}
.pipwrap .bl{color:var(--signal-strong);}
.pipwrap .bt{font-size:14px;font-weight:600;}
.pipwrap .bn{font-size:15px;font-weight:700;}
.pipwrap .bc{font-size:10px;color:var(--ink-3);}
.pipwrap .bar-tk{flex:1 1 auto;min-height:0;border-top:1px solid var(--line);}
.pipwrap .sq{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;height:100%;text-align:center;padding:6px;}
.pipwrap .sql{font-family:var(--mono);font-size:9px;letter-spacing:.06em;color:var(--signal-strong);}
.pipwrap .sqn{font-size:26px;font-weight:700;letter-spacing:-.02em;line-height:1;}
.pipwrap .sqt{font-size:12px;font-weight:600;color:var(--ink-2);}
.pipwrap .cols{display:grid;grid-template-columns:1fr .85fr;gap:12px;margin-top:8px;border-top:1px solid var(--line);padding-top:8px;}
.pipwrap .cols .r{border-left:1px solid var(--line);padding-left:12px;}
.pipwrap .colh{font-family:var(--mono);font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3);margin-bottom:6px;}
.pipwrap .lc{display:flex;align-items:center;gap:6px;font-family:var(--mono);font-size:12px;padding:2px 0;}
.pipwrap .lc .lct{color:var(--ink-3);font-size:10px;min-width:30px;}
.pipwrap .wide-wrap{display:flex;flex-direction:column;height:100%;}
.pipwrap .wide-row{flex:1 1 auto;display:grid;grid-template-columns:minmax(140px,.7fr) 1.3fr;gap:14px;align-items:center;min-height:0;padding:8px 14px;}
.pipwrap .wide-row .team{font-size:18px;}.pipwrap .wide-row .num{font-size:20px;}
.pipwrap .wide-r{align-self:stretch;border-left:1px solid var(--line);padding-left:14px;display:flex;flex-direction:column;justify-content:center;overflow:hidden;}
.pipwrap .wide-tk{flex:0 0 26px;min-height:0;border-top:1px solid var(--line);}
.pipwrap.in-pip{width:100%;height:100%;border:0;border-radius:0;}
.pipwrap.overlay{position:fixed;z-index:70;box-shadow:0 18px 50px rgba(0,0,0,.55);}
.pipwrap.overlay[data-layout="bar"]{left:0;right:0;bottom:0;top:auto;width:auto;height:48px;border-radius:0;border-width:1px 0 0;}
.pipwrap.overlay[data-layout="wide"]{left:0;right:0;bottom:0;top:auto;width:auto;height:120px;border-radius:0;border-width:1px 0 0;}
.pipwrap.overlay[data-layout="square"]{right:16px;bottom:70px;width:150px;height:150px;}
.pipwrap.overlay[data-layout="full"]{right:16px;bottom:70px;width:320px;}
.pip-host{height:100vh;margin:0;display:flex;background:var(--bg);}
`;

const MODES: PipLayout[] = ["bar", "square", "full", "wide"];
const MODE_LABEL: Record<PipLayout, string> = { bar: "BARRA", square: "QUAD", full: "CHEIO", wide: "LARGO" };
const STATUS_TAG: Record<RankedPrediction["status"], [string, string]> = {
  winning: ["win", "cravou"],
  can: ["can", "no caminho"],
  losing: ["", "fora"],
};

interface Data { match: Match | null; ranked: RankedPrediction[] }

const isLive = (m: Match) => m.state === "in";
const clockText = (m: Match) =>
  isLive(m) ? `● Ao vivo · ${m.displayClock || m.statusDetail}` : m.statusDetail || "";

function feedItems(m: Match) {
  const goals = m.goals.map((g) => ({ side: g.side, clock: g.clock, who: g.scorer, t: "goal" as const }));
  const cards = m.cards.map((c) => ({ side: c.side, clock: c.clock, who: c.player, t: "card" as const, kind: c.kind }));
  return [...goals, ...cards].sort((a, b) => clockOrder(a.clock) - clockOrder(b.clock));
}

function feedCols(m: Match) {
  const rowFor = (e: ReturnType<typeof feedItems>[number], side: "home" | "away") => {
    const b = e.t === "goal" ? `⚽ ${esc(e.who)}` : `<span class="chip ${e.kind}"></span> ${esc(e.who)}`;
    return side === "home"
      ? `<div><span class="clk">${esc(e.clock)}</span> ${b}</div>`
      : `<div class="away">${b} <span class="clk">${esc(e.clock)}</span></div>`;
  };
  const side = (s: "home" | "away") => feedItems(m).filter((e) => e.side === s).map((e) => rowFor(e, s)).join("");
  return `<div class="feed"><div>${side("home")}</div><div>${side("away")}</div></div>`;
}

function lancesList(m: Match) {
  return feedItems(m)
    .map((e) => {
      const team = e.side === "home" ? m.home.abbreviation : m.away.abbreviation;
      const b = e.t === "goal" ? `⚽ ${esc(e.who)}` : `<span class="chip ${e.kind}"></span> ${esc(e.who)}`;
      return `<div class="lc"><span class="clk">${esc(e.clock)}</span> <span class="lct">${esc(team)}</span> ${b}</div>`;
    })
    .join("");
}

function ticker(ranked: RankedPrediction[]) {
  if (!ranked.length) return `<div class="ticker"><span class="meta" style="padding-left:14px">Sem palpites ainda</span></div>`;
  const items = ranked
    .map((p) => {
      const [cls, label] = STATUS_TAG[p.status];
      return `<span class="ti"><span class="nm">${esc(p.username)}</span> <span>${p.predHome}–${p.predAway}</span> <span class="tag ${cls}">${label}</span></span>`;
    })
    .join("");
  return `<div class="ticker"><span class="tlbl">Palpites</span><div class="track">${items}${items}</div></div>`;
}

function palpitesList(ranked: RankedPrediction[]) {
  if (!ranked.length) return `<div class="meta">Sem palpites ainda</div>`;
  return ranked
    .map((p) => {
      const [cls, label] = STATUS_TAG[p.status];
      return `<div class="pl"><span class="nm">${esc(p.username)}</span><span><span class="pr">${p.predHome}–${p.predAway}</span> <span class="tag ${cls}">${label}</span></span></div>`;
    })
    .join("");
}

function scoreTop(m: Match) {
  return `<div class="top"><span class="live">${esc(clockText(m))}</span><span class="meta">${esc(m.venue ?? "")}</span></div>`;
}
function scoreRow(m: Match) {
  const hs = m.homeScore ?? 0, as = m.awayScore ?? 0;
  return `<div class="score"><div class="team">${esc(m.home.abbreviation)}</div><div class="num">${hs}–${as}</div><div class="team away">${esc(m.away.abbreviation)}</div></div>`;
}

function buildBody(lay: PipLayout, d: Data): string {
  const m = d.match;
  if (!m) return `<div class="body"><div class="meta">Nenhum jogo agora.</div></div>`;
  const cyc = `<div class="ctrl"><button class="cyc" data-cyc title="Trocar tamanho">Trocar tamanho · ${MODE_LABEL[lay]}</button></div>`;
  let inner: string;
  if (lay === "bar") {
    const hs = m.homeScore ?? 0, as = m.awayScore ?? 0;
    inner = `<div class="bar-stack"><div class="bar-score"><span class="bl">${isLive(m) ? "●" : ""}</span><span class="bt">${esc(m.home.abbreviation)}</span><span class="bn">${hs}–${as}</span><span class="bt">${esc(m.away.abbreviation)}</span><span class="bc">${esc(isLive(m) ? m.displayClock || m.statusDetail : m.statusDetail)}</span></div><div class="bar-tk">${ticker(d.ranked)}</div></div>`;
  } else if (lay === "square") {
    const hs = m.homeScore ?? 0, as = m.awayScore ?? 0;
    inner = `<div class="sq"><div class="sql">${isLive(m) ? "● " : ""}${esc(isLive(m) ? m.displayClock || m.statusDetail : m.statusDetail)}</div><div class="sqn">${hs}–${as}</div><div class="sqt">${esc(m.home.abbreviation)} · ${esc(m.away.abbreviation)}</div></div>`;
  } else if (lay === "wide") {
    const right = m.goals.length || m.cards.length ? feedCols(m) : `<div class="meta">Sem lances</div>`;
    inner = `<div class="wide-wrap"><div class="wide-row"><div>${scoreTop(m)}${scoreRow(m)}</div><div class="wide-r">${right}</div></div><div class="wide-tk">${ticker(d.ranked)}</div></div>`;
  } else {
    const lances = m.goals.length || m.cards.length ? lancesList(m) : `<div class="meta">Sem lances</div>`;
    inner = `<div class="body">${scoreTop(m)}${scoreRow(m)}<div class="cols"><div class="l"><div class="colh">Lances</div>${lances}</div><div class="r"><div class="colh">Palpites</div>${palpitesList(d.ranked)}</div></div></div>`;
    return cyc + inner; // full already wraps its own .body
  }
  return cyc + `<div class="body">${inner}</div>`;
}

function currentTheme(): string {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

/** Floating "PiP" control rendered beside Modo Streamer. */
export function PipView() {
  const [open, setOpen] = useState(false);
  const pipRef = useRef<Window | null>(null);
  const miniRef = useRef<HTMLDivElement | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  const pollRef = useRef<number | undefined>(undefined);
  const dataRef = useRef<Data>({ match: null, ranked: [] });
  const chosenRef = useRef<PipLayout>("full");
  const lockRef = useRef<PipLayout | null>(null);
  const lockTimerRef = useRef<number | undefined>(undefined);
  const hostRef = useRef<"none" | "pip" | "overlay">("none");

  const paint = useCallback((lay: PipLayout) => {
    const mini = miniRef.current;
    if (!mini) return;
    mini.dataset.layout = lay;
    mini.dataset.theme = currentTheme();
    mini.innerHTML = buildBody(lay, dataRef.current);
  }, []);

  const resolvedLayout = useCallback((): PipLayout => {
    if (lockRef.current) return lockRef.current;
    const pip = pipRef.current;
    if (hostRef.current === "pip" && pip && !pip.closed) {
      const el = pip.document.documentElement;
      const w = el.clientWidth || pip.innerWidth;
      const h = el.clientHeight || pip.innerHeight;
      return resolveLayout(w, h, miniRef.current?.dataset.layout === "bar");
    }
    return chosenRef.current; // overlay has no resizable window
  }, []);

  const render = useCallback(() => paint(resolvedLayout()), [paint, resolvedLayout]);

  const setSize = useCallback((m: PipLayout) => {
    chosenRef.current = m;
    const pip = pipRef.current;
    if (hostRef.current === "pip" && pip && !pip.closed) {
      lockRef.current = m;
      render(); // paint the (small) target first so the window can shrink to it
      const [w, h] = LAYOUT_SIZE[m];
      const raf = pip.requestAnimationFrame || requestAnimationFrame;
      raf(() => { try { pip.resizeTo(w, h); } catch { /* some builds restrict resize */ } });
      window.clearTimeout(lockTimerRef.current);
      lockTimerRef.current = window.setTimeout(() => { lockRef.current = null; render(); }, 600);
      return;
    }
    render();
  }, [render]);

  const cycle = useCallback(() => {
    setSize(MODES[(MODES.indexOf(resolvedLayout()) + 1) % MODES.length]);
  }, [resolvedLayout, setSize]);

  // One delegated click handler on the mini for the in-view "Trocar tamanho".
  const onMiniClick = useCallback((e: Event) => {
    if ((e.target as HTMLElement).closest("[data-cyc]")) cycle();
  }, [cycle]);

  const fetchData = useCallback(async () => {
    try {
      const matches = await fetchScoreboard({ dates: FIFA_WORLD_DATE_RANGE });
      const match = pickMatch(matches, Date.now());
      let ranked: RankedPrediction[] = [];
      if (match) {
        const client = getSupabaseClient();
        if (client) {
          const entries = await fetchVoteEntries(client, match.id);
          ranked = rankPredictions(entries, { home: match.homeScore ?? 0, away: match.awayScore ?? 0 });
        }
      }
      dataRef.current = { match, ranked };
      render();
    } catch {
      /* keep last good data */
    }
  }, [render]);

  const teardown = useCallback(() => {
    window.clearInterval(pollRef.current);
    window.clearTimeout(lockTimerRef.current);
    roRef.current?.disconnect();
    roRef.current = null;
    lockRef.current = null;
    miniRef.current?.removeEventListener("click", onMiniClick);
    if (pipRef.current && !pipRef.current.closed) pipRef.current.close();
    pipRef.current = null;
    miniRef.current = null;
    hostRef.current = "none";
    setOpen(false);
  }, [onMiniClick]);

  const startData = useCallback(() => {
    fetchData();
    window.clearInterval(pollRef.current);
    pollRef.current = window.setInterval(fetchData, POLL_MS);
  }, [fetchData]);

  const makeMini = useCallback(() => {
    const mini = document.createElement("div");
    mini.className = "pipwrap";
    mini.addEventListener("click", onMiniClick);
    miniRef.current = mini;
    return mini;
  }, [onMiniClick]);

  const openOverlay = useCallback(() => {
    const style = document.createElement("style");
    style.dataset.pip = "1";
    style.textContent = PIP_CSS;
    document.head.appendChild(style);
    const mini = makeMini();
    mini.classList.add("overlay");
    document.body.appendChild(mini);
    hostRef.current = "overlay";
    setOpen(true);
    chosenRef.current = "bar";
    startData();
    render();
  }, [makeMini, render, startData]);

  const openPip = useCallback(async () => {
    const dpip = (window as unknown as { documentPictureInPicture?: { requestWindow: (o: { width: number; height: number }) => Promise<Window> } }).documentPictureInPicture;
    if (!dpip) { openOverlay(); return; }
    const [w, h] = LAYOUT_SIZE[chosenRef.current];
    const pip = await dpip.requestWindow({ width: w, height: h });
    pipRef.current = pip;
    hostRef.current = "pip";
    const style = pip.document.createElement("style");
    style.textContent = PIP_CSS;
    pip.document.head.appendChild(style);
    pip.document.body.classList.add("pip-host");
    const mini = makeMini();
    mini.classList.add("in-pip");
    pip.document.body.appendChild(mini);
    pip.addEventListener("resize", render);
    try {
      const RO = (pip as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver;
      const ro = new RO(() => render());
      ro.observe(pip.document.documentElement);
      roRef.current = ro;
    } catch { /* ResizeObserver unavailable */ }
    pip.addEventListener("pagehide", teardown);
    setOpen(true);
    startData();
    render();
  }, [makeMini, openOverlay, render, startData, teardown]);

  const toggle = useCallback(() => {
    if (hostRef.current !== "none") teardown();
    else openPip();
  }, [openPip, teardown]);

  // Clean up if the component unmounts (it normally lives for the page's life).
  useEffect(() => () => teardown(), [teardown]);

  return (
    <button
      onClick={toggle}
      title={open ? "Fechar janela flutuante" : "Abrir placar + palpites em janela flutuante (PiP)"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        fontFamily: "var(--font-jb)",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        padding: "9px 13px",
        borderRadius: 8,
        cursor: "pointer",
        boxShadow: "0 6px 22px rgba(0,0,0,0.4)",
        background: open ? "rgba(67,184,106,0.16)" : "rgba(255,255,255,0.04)",
        color: open ? "#bff0cf" : "#bdd6d9",
        border: `1px solid ${open ? "rgba(98,203,132,0.55)" : "rgba(255,255,255,0.14)"}`,
      }}
    >
      <PictureInPicture size={14} />
      PIP
    </button>
  );
}
