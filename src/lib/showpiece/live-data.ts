import type { VoteEntry } from "@/lib/votes";
import type { SubRank } from "@/lib/ranking";
import type { Scenario } from "@/lib/showpiece/dossiers";

/**
 * Mock live-engagement data for the v2 showpiece: a stream of chat palpites
 * ("palpites chegando") and a Ranking dos Subs. All local/fabricated so the
 * design can be reviewed without real ESPN/Supabase.
 */

// Kick-style nicknames for the incoming-palpite feed.
const NICKS = [
  "zé_do_boné", "MessiEnjoyer10", "la_roja_fan", "GremistaRaiz", "tuchel_out",
  "brabo.ncr", "yamal_16", "DizGamer", "capitao_nascimento", "furia_vermelha",
  "mbappe_ge", "kane_penalti", "sub_do_dia", "cravador_serial", "palpiteiro_jr",
  "torcedor_neutro", "aposta_certa", "vasco_ate_morrer", "julian_alvarez9", "o_analista",
  "gols_e_cia", "boleiro77", "resenha_fc", "tati_futebol",
];

/** A stream of chat palpites for the scenario's match. `createdAt` increases with
 *  index so the feed's newest-first ordering reveals later ones on top; a few
 *  repeat nicks (with a different score) later in the list trigger the "alterado"
 *  (re-palpite) styling. */
export function chegandoPool(scenario: Scenario, nowMs: number): VoteEntry[] {
  const { match } = scenario;
  // Deterministic-ish scoreline spread, biased toward tight knockout results.
  const scores: [number, number][] = [
    [2, 1], [1, 1], [2, 0], [1, 2], [0, 0], [3, 1], [1, 0], [2, 2],
    [0, 1], [3, 2], [2, 1], [1, 1], [4, 2], [0, 2], [1, 3], [2, 1],
    [1, 0], [2, 3], [0, 0], [1, 1],
  ];
  const base = nowMs - scores.length * 4200;
  const entries: VoteEntry[] = scores.map(([h, a], i) => ({
    matchId: match.id,
    league: match.league,
    username: NICKS[i % NICKS.length],
    predHome: h,
    predAway: a,
    createdAt: new Date(base + i * 4200).toISOString(),
  }));
  // Two "re-palpites": same nick reappears later with a new scoreline → "alterado".
  entries.push({ matchId: match.id, league: match.league, username: "GremistaRaiz", predHome: 3, predAway: 0, createdAt: new Date(nowMs + 3000).toISOString() });
  entries.push({ matchId: match.id, league: match.league, username: "yamal_16", predHome: 1, predAway: 3, createdAt: new Date(nowMs + 6500).toISOString() });
  return entries;
}

/** A believable Ranking dos Subs snapshot (fractional totals = pen halves +
 *  bracket points), leader first. Same shape rankSubs produces, so the panel is
 *  identical whether it's fed this or the real ranking.
 *
 *  Nicknames are INVENTED on purpose. These sandbox routes are publicly reachable
 *  once deployed, and made-up win/loss records shown under real subs' nicknames
 *  would read as a genuine standings table. Only the house bot is real, because
 *  it's the app's own account rather than a person. */
export const MOCK_RANKING: SubRank[] = [
  { username: "ChatGPT", wins: 15, losses: 86, penWins: 0, penLosses: 1 },
  { username: "cravador_geral", wins: 9, losses: 45, penWins: 0, penLosses: 2 },
  { username: "tati_palpite", wins: 9, losses: 43, penWins: 0, penLosses: 2 },
  { username: "boleiro_77", wins: 7.5, losses: 57, penWins: 3, penLosses: 0 },
  { username: "zagueiro_zen", wins: 7, losses: 42, penWins: 0, penLosses: 1 },
  { username: "resenha_fc", wins: 6.5, losses: 25, penWins: 1, penLosses: 0 },
  { username: "meia_armador", wins: 6, losses: 40, penWins: 0, penLosses: 0 },
  { username: "sub_do_dia", wins: 5, losses: 13, penWins: 0, penLosses: 0 },
  { username: "camisa_10", wins: 5, losses: 37, penWins: 0, penLosses: 2 },
  { username: "voce_aqui", wins: 4.4, losses: 61, penWins: 0, penLosses: 3 },
  { username: "gols_e_cia", wins: 4, losses: 38, penWins: 0, penLosses: 2 },
  { username: "neutro_fc", wins: 3, losses: 38, penWins: 0, penLosses: 2 },
];
