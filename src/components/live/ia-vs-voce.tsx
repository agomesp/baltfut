"use client";

import { useMemo, type CSSProperties } from "react";
import type { Match } from "@/lib/espn";
import type { VoteEntry } from "@/lib/votes";
import { headToHead } from "@/lib/ranking";
import { useMyName } from "@/lib/use-my-name";
import { BRIC, JB, SAIRA, LIME, GOLD, DIM, DIM_2, RAINBOW_NAME } from "@/components/live/bf-ui";

/** The house bot's nickname — it has a palpite on every game, so it's the natural
 *  benchmark for a viewer's accuracy. */
const BOT = "ChatGPT";

/** One side of the duel: name + big hit count, lime-tinted when it's leading. */
function Side({ name, hits, rainbow, lead }: { name: string; hits: number; rainbow?: boolean; lead: boolean }) {
  return (
    <div style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
      <div style={{ fontFamily: BRIC, fontWeight: 800, fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", ...(rainbow ? RAINBOW_NAME : { color: lead ? LIME : "#e9ece8" }) }}>{name}</div>
      <div style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: 24, lineHeight: 1, color: lead ? LIME : "#fff", marginTop: 1 }}>{hits}</div>
      <div style={{ fontFamily: JB, fontSize: 7.5, letterSpacing: "0.08em", color: DIM_2 }}>ACERTOS</div>
    </div>
  );
}

/**
 * "🤖 IA vs Você": a fun tournament-long head-to-head between the house bot and
 * the viewer's nickname, scored on exact-score hits over the matches BOTH
 * palpitado (fair). Stream candy + a payoff right after you palpite. Pure UI off
 * allEntries + matches.
 */
export function IaVsVoce({ entries, matches, style, name }: { entries: VoteEntry[]; matches: Match[]; style?: CSSProperties; name?: string | null }) {
  // Prefer the name the caller already resolved (the pre-match form's prefilled /
  // draft nickname) so the duel lights up the moment a recognized name sits in the
  // input — the same recognition that drives "PALPITE ENVIADO". Falls back to the
  // locked localStorage name (useMyName) when no caller name is given (live view).
  const hookName = useMyName();
  const myName = name !== undefined ? name : hookName;
  const byId = useMemo(() => {
    const m: Record<string, Match> = {};
    for (const x of matches) m[x.id] = x;
    return m;
  }, [matches]);
  const h2h = useMemo(() => headToHead(entries, byId, BOT, myName ?? ""), [entries, byId, myName]);

  const card: CSSProperties = { borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", padding: "9px 13px", display: "flex", flexDirection: "column", gap: 5, ...style };
  const header = (
    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
      <span style={{ fontFamily: JB, fontSize: 10, letterSpacing: "0.12em", color: GOLD }}>🤖 IA vs VOCÊ</span>
    </div>
  );

  // No nickname yet → invite them to challenge the bot.
  if (!myName) {
    return (
      <div style={card}>
        {header}
        <div style={{ fontFamily: BRIC, fontSize: 12, color: DIM, lineHeight: 1.45 }}>
          A <span style={{ ...RAINBOW_NAME, fontWeight: 700 }}>ChatGPT</span> já palpitou todos os jogos. Faça um palpite para desafiar a IA — seu placar aparece aqui.
        </div>
      </div>
    );
  }

  const verdict =
    h2h.lead === "tie"
      ? `Empate ${h2h.bHits}–${h2h.aHits}`
      : h2h.lead === "b"
        ? `Você lidera ${h2h.bHits}–${h2h.aHits}! 🔥`
        : `A IA lidera ${h2h.aHits}–${h2h.bHits}`;
  const verdictColor = h2h.lead === "b" ? LIME : h2h.lead === "a" ? "#ff8f8f" : DIM;

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontFamily: JB, fontSize: 10, letterSpacing: "0.12em", color: GOLD, whiteSpace: "nowrap", flex: "none" }}>🤖 IA vs VOCÊ</span>
        {h2h.shared > 0 ? (
          <div style={{ display: "flex", flex: 1, flexWrap: "wrap", justifyContent: "flex-end", alignItems: "baseline", gap: "0 6px", minWidth: 0 }}>
            <span style={{ fontFamily: JB, fontSize: 10, letterSpacing: "0.02em", color: verdictColor, fontWeight: 700, whiteSpace: "nowrap" }}>{verdict}</span>
            <span style={{ fontFamily: JB, fontSize: 8.5, letterSpacing: "0.04em", color: DIM_2, whiteSpace: "nowrap" }}>
              {h2h.shared} {h2h.shared === 1 ? "jogo" : "jogos"}
              {h2h.last ? ` · últ. ${h2h.last.home}–${h2h.last.away}: IA ${h2h.last.aHit ? "✓" : "✗"} · você ${h2h.last.bHit ? "✓" : "✗"}` : ""}
            </span>
          </div>
        ) : null}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Side name="ChatGPT" hits={h2h.aHits} rainbow lead={h2h.lead === "a"} />
        <span style={{ fontFamily: JB, fontSize: 10, color: DIM_2, flex: "none" }}>VS</span>
        <Side name={myName} hits={h2h.bHits} lead={h2h.lead === "b"} />
      </div>
      {h2h.shared === 0 ? (
        <div style={{ fontFamily: BRIC, fontSize: 11, color: DIM, textAlign: "center" }}>Ainda sem jogos avaliados — volte após os resultados.</div>
      ) : null}
    </div>
  );
}
