"use client";

// Per-team lineup editor: pick a formation and choose which drafted players start
// (the rest are bench), respecting per-position caps and player availability
// (suspended / injured players can't be picked). Used before/between rounds.

import { CATS, CAT_ABBR, CAT_COLOR } from "@/lib/subs-draft/data";
import type { Team } from "@/lib/subs-draft/engine";
import {
  autoLineup,
  available,
  catNeed,
  FORMATIONS,
  formationByName,
  repairLineup,
  starterIds,
  toggleStarter,
  unavailableLabel,
  type Lineup,
  type StatusMap,
} from "@/lib/subs-draft/squad";
import { FlagIcon } from "@/components/live/bf-ui";

const LIME = "#c8ff2d";
const INK = "#e7f0e9";
const DIM = "#7e8f84";
const LINE = "rgba(200,255,45,0.16)";
const MONO = "var(--font-jb, ui-monospace)";
const DISP = "var(--font-bric, system-ui)";

export default function LineupEditor({
  team, lineup, status, onChange, onClose,
}: {
  team: Team;
  lineup: Lineup;
  status: StatusMap;
  onChange: (l: Lineup) => void;
  onClose: () => void;
}) {
  const f = formationByName(lineup.formation);
  const need = catNeed(f);
  const starters = new Set(starterIds(lineup));

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 560, background: "#0c1611", border: `1px solid ${LINE}`, borderRadius: 16, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <FlagIcon code={team.code} size={20} />
          <span style={{ fontFamily: DISP, fontSize: 19, fontWeight: 800, flex: 1 }}>{team.owner.replace(" 🤖", "")}</span>
          <span style={{ fontFamily: MONO, fontSize: 12, color: starters.size === 11 ? LIME : "#ff8e6b" }}>Titulares {starters.size}/11</span>
          <button onClick={onClose} style={{ border: "none", background: "transparent", color: DIM, fontSize: 20, cursor: "pointer" }}>×</button>
        </div>

        {/* formation + auto */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
          <span style={{ fontFamily: MONO, fontSize: 11, color: DIM, marginRight: 4 }}>FORMAÇÃO</span>
          {FORMATIONS.map((fm) => (
            <button
              key={fm.name}
              onClick={() => onChange(repairLineup(team, { ...lineup, formation: fm.name }, status))}
              style={{ ...chip, borderColor: fm.name === lineup.formation ? LIME : LINE, color: fm.name === lineup.formation ? "#0a120d" : INK, background: fm.name === lineup.formation ? LIME : "transparent", fontWeight: fm.name === lineup.formation ? 800 : 500 }}
            >
              {fm.name}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <button onClick={() => onChange(autoLineup(team, lineup.formation, status))} style={chip}>Auto</button>
        </div>

        {/* by position */}
        <div style={{ display: "grid", gap: 12 }}>
          {CATS.map((cat) => {
            const cap = cat === "Goleiro" ? 1 : need[cat];
            const chosen = team.roster[cat].filter((p) => starters.has(p.id)).length;
            const players = [...team.roster[cat]].sort((a, b) => b.rating - a.rating);
            return (
              <div key={cat}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: CAT_COLOR[cat], fontWeight: 800 }}>{CAT_ABBR[cat]}</span>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: chosen === cap ? DIM : "#ff8e6b" }}>{chosen}/{cap}</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {players.map((p) => {
                    const isStarter = starters.has(p.id);
                    const isAvail = available(status, p.id);
                    const why = unavailableLabel(status[p.id]);
                    return (
                      <button
                        key={p.id}
                        disabled={!isAvail}
                        onClick={() => onChange(toggleStarter(team, lineup, p.id))}
                        title={why ?? `${p.name} · ${p.rating}`}
                        style={{
                          display: "flex", alignItems: "center", gap: 6, padding: "6px 9px", borderRadius: 8, cursor: isAvail ? "pointer" : "not-allowed",
                          border: `1px solid ${isStarter ? LIME : LINE}`,
                          background: isStarter ? "rgba(200,255,45,0.14)" : "rgba(255,255,255,0.03)",
                          color: !isAvail ? DIM : INK, opacity: !isAvail ? 0.6 : 1,
                        }}
                      >
                        <span style={{ fontSize: 12, fontWeight: isStarter ? 700 : 500 }}>{p.name}</span>
                        <span style={{ fontFamily: MONO, fontSize: 10, color: DIM }}>{p.rating}</span>
                        {why && <span style={{ fontSize: 10 }}>{why}</span>}
                        {isStarter && !why && <span style={{ fontSize: 10, color: LIME }}>●</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <button onClick={onClose} style={{ ...chip, marginTop: 16, width: "100%", padding: "10px", background: LIME, color: "#0a120d", border: "none", fontWeight: 800 }}>
          Pronto
        </button>
      </div>
    </div>
  );
}

const chip: React.CSSProperties = { padding: "7px 11px", borderRadius: 999, border: `1px solid ${LINE}`, background: "transparent", color: INK, fontFamily: MONO, fontSize: 12, cursor: "pointer" };
