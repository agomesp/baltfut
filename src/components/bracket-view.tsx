import type { Match, KnockoutColumn } from "@/lib/espn";
import { isPlaceholderTeam, seedLabel, matchShootout } from "@/lib/espn";
import { teamNamePt } from "@/lib/team-names";
import { BRIC, JB, SAIRA, LIME, GOLD_DEEP, FlagIcon, ViewHeader } from "@/components/live/bf-ui";
import { ConnectedBracket, type BracketRound } from "@/components/connected-bracket";

export interface BracketViewProps {
  /** Real knockout fixtures from ESPN, grouped into ordered stage columns. */
  stages: KnockoutColumn[];
}

const colHead = { fontFamily: JB, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase" as const, paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.07)", marginBottom: 6 };
const slotCard = { borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" };

/** The 32-avos → final championship path (the 3rd-place match rides alongside
 *  the champion, not in the connected ladder). */
const MAIN_SLUGS = ["round-of-32", "round-of-16", "quarterfinals", "semifinals", "final"];

function ColHead({ label, color = "#9bb6a6" }: { label: string; color?: string }) {
  return <div style={{ ...colHead, color }}>{label}</div>;
}

/** One side of a tie: a decided team (flag + code + name) or a placeholder seed
 *  ("2º Grupo H", "Venc. 32-avos 1"). Shows the score once the match is underway,
 *  plus the penalty tally (and a lime highlight on the advancing side) when the
 *  tie was decided on penalties. */
function Slot({ team, score, pen, won = false }: { team: Match["home"]; score: number | null; pen?: number | null; won?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "7px 11px" }}>
      {isPlaceholderTeam(team.name) ? (
        <span style={{ fontFamily: JB, fontSize: 11, letterSpacing: "0.02em", color: "#8fa898", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{seedLabel(team.name)}</span>
      ) : (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <FlagIcon code={team.abbreviation} size={12} />
          <span style={{ fontFamily: BRIC, fontWeight: 800, fontSize: 13, color: won ? LIME : "#f1f7f0" }}>{team.abbreviation}</span>
          <span style={{ fontFamily: BRIC, fontSize: 11.5, color: "#7d9a86", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{teamNamePt(team.abbreviation, team.name)}</span>
        </span>
      )}
      {score != null ? (
        <span style={{ display: "inline-flex", alignItems: "baseline", gap: 3, flex: "none" }}>
          <span style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: 15, color: "#fff" }}>{score}</span>
          {pen != null ? <span style={{ fontFamily: JB, fontSize: 9, color: GOLD_DEEP }}>({pen})</span> : null}
        </span>
      ) : null}
    </div>
  );
}

/** A knockout tie card (two stacked slots), score shown once underway. */
function MatchCard({ mt }: { mt: Match }) {
  const played = mt.state !== "pre";
  const so = matchShootout(mt); // pens → show tally + advancer
  return (
    <div style={slotCard}>
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <Slot team={mt.home} score={played ? mt.homeScore ?? 0 : null} pen={so?.home ?? null} won={so?.winner === "home"} />
      </div>
      <Slot team={mt.away} score={played ? mt.awayScore ?? 0 : null} pen={so?.away ?? null} won={so?.winner === "away"} />
    </div>
  );
}

export function BracketView({ stages }: BracketViewProps) {
  const bySlug = new Map(stages.map((s) => [s.slug, s]));
  const rounds: BracketRound[] = MAIN_SLUGS.map((slug) => bySlug.get(slug))
    .filter((c): c is KnockoutColumn => c != null)
    .map((col) => ({
      key: col.slug,
      label: <ColHead label={col.label} />,
      items: col.matches.map((mt) => <MatchCard key={mt.id} mt={mt} />),
    }));
  const third = bySlug.get("3rd-place-match")?.matches[0];

  const trailing = {
    width: 200,
    label: <ColHead label="Campeão" color={LIME} />,
    content: (
      <>
        <div style={{ borderRadius: 14, border: "1px solid rgba(200,255,45,0.45)", background: "linear-gradient(180deg, rgba(200,255,45,0.06), transparent)", boxShadow: "0 0 30px -10px rgba(200,255,45,0.5)", padding: "26px 16px", textAlign: "center" as const }}>
          <div style={{ fontFamily: SAIRA, fontWeight: 800, fontSize: 52, lineHeight: 1, color: LIME }}>?</div>
          <div style={{ fontFamily: JB, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "#9bb6a6", marginTop: 10 }}>Levante a taça</div>
        </div>
        {third ? (
          <div style={{ marginTop: 18 }}>
            <div style={{ ...colHead, color: "#9bb6a6" }}>3º lugar</div>
            <MatchCard mt={third} />
          </div>
        ) : null}
      </>
    ),
  };

  return (
    <section>
      <ViewHeader label="// CHAVEAMENTO" sub="mata-mata · times já definidos aparecem com bandeira; os demais resolvem conforme a fase de grupos avança · linhas ligam ao próximo jogo" />

      {stages.length === 0 ? (
        <div style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", padding: "40px 24px", textAlign: "center", fontFamily: BRIC, color: "#8fa898" }}>
          O mata-mata ainda não foi sorteado.
        </div>
      ) : (
        <div style={{ overflowX: "auto", paddingBottom: 12 }}>
          <ConnectedBracket rounds={rounds} colWidth={244} unitHeight={78} gap={24} trailing={trailing} />
        </div>
      )}
    </section>
  );
}
