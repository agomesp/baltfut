import type { VoteEntry } from "@/lib/votes";
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

export interface MockSub {
  username: string;
  wins: number;
  losses: number;
  penWins: number;
  penLosses: number;
  you?: boolean;
}

/** A believable Ranking dos Subs snapshot (fractional totals = pen halves +
 *  bracket points), leader first. */
export const MOCK_RANKING: MockSub[] = [
  { username: "ChatGPT", wins: 15, losses: 86, penWins: 0, penLosses: 1 },
  { username: "LEMES", wins: 9, losses: 45, penWins: 0, penLosses: 2 },
  { username: "martineza", wins: 9, losses: 43, penWins: 0, penLosses: 2 },
  { username: "Zinnecwb", wins: 7.5, losses: 57, penWins: 3, penLosses: 0 },
  { username: "FlinTH", wins: 7, losses: 42, penWins: 0, penLosses: 1 },
  { username: "jmello123", wins: 6.5, losses: 25, penWins: 1, penLosses: 0 },
  { username: "Synced", wins: 6, losses: 40, penWins: 0, penLosses: 0 },
  { username: "mikeggabs", wins: 5, losses: 13, penWins: 0, penLosses: 0 },
  { username: "Picapau", wins: 5, losses: 37, penWins: 0, penLosses: 2 },
  { username: "agomesp", wins: 4.4, losses: 61, penWins: 0, penLosses: 3, you: true },
  { username: "LilJam", wins: 4, losses: 38, penWins: 0, penLosses: 2 },
  { username: "drakad", wins: 3, losses: 38, penWins: 0, penLosses: 2 },
];
