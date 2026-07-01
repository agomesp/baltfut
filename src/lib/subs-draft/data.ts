// Subs draft game — MOCK data (local-only spike). Positions, roster shape, the
// claimable countries, and a deterministic player pool. No backend.

export type Cat = "Goleiro" | "Defensor" | "Meio-campo" | "Atacante";

export const CATS: Cat[] = ["Goleiro", "Defensor", "Meio-campo", "Atacante"];

export const CAT_ABBR: Record<Cat, string> = {
  Goleiro: "GOL",
  Defensor: "DEF",
  "Meio-campo": "MEI",
  Atacante: "ATA",
};

export const CAT_COLOR: Record<Cat, string> = {
  Goleiro: "#f2c14e",
  Defensor: "#7db3ff",
  "Meio-campo": "#c8ff2d",
  Atacante: "#ff6b6b",
};

/**
 * How many players each team drafts per category (squad = sum = 18). Enough for a
 * starting XI in any formation (≤5 in any one outfield line) PLUS a 7-man bench.
 */
export const ROSTER: Record<Cat, number> = {
  Goleiro: 2,
  Defensor: 6,
  "Meio-campo": 6,
  Atacante: 4,
};
export const SQUAD_SIZE = (Object.values(ROSTER) as number[]).reduce((a, b) => a + b, 0);

/** Countries a sub can claim — first to pick it gets it. 32 = a full bracket. */
export const COUNTRIES = [
  "BRA", "ARG", "FRA", "ESP", "ENG", "GER", "POR", "NED",
  "ITA", "BEL", "CRO", "URU", "COL", "MEX", "USA", "JPN",
  "KOR", "MAR", "SEN", "GHA", "CMR", "EGY", "NGA", "SUI",
  "DEN", "SRB", "POL", "SWE", "AUS", "QAT", "ECU", "NOR",
];

/** Bracket size — a single-elimination knockout needs a power of two. */
export const BRACKET_SIZE = 32;

/** Nicknames for mock (auto-filled) subs when a real lobby is short of 32. */
export const MOCK_SUBS = [
  "Zé", "Tonho", "Duda", "NegoVê", "WillG", "Rai", "Dedé", "Lela",
  "Bibi", "Téo", "Vavá", "Nina", "Gugu", "PêH", "Cacá", "Dão",
  "Sasa", "Tutu", "Juca", "Mara", "FêT", "Babi", "Rota", "Kiko",
  "Zuza", "Lipe", "Dani", "ViniJ", "Manu", "Pedrin", "Gabi", "Rik",
];

export interface Player {
  id: string;
  name: string;
  cat: Cat;
  rating: number;
  club: string;
}

const FIRST = ["Léo", "Gabriel", "Matheus", "João", "Pedro", "Lucas", "Bruno", "Rafael", "Diego", "Felipe", "Caio", "Igor", "Vitor", "Enzo", "Davi", "Yuri", "André", "Thiago", "Murilo", "Kauã"];
const LAST = ["Silva", "Souza", "Costa", "Lima", "Almeida", "Pereira", "Rocha", "Mendes", "Barbosa", "Cardoso", "Nunes", "Teixeira", "Ramos", "Moreira", "Freitas", "Gomes", "Araújo", "Pinto", "Dias", "Martins"];
const CLUBS = ["RB Bragantino", "Palmeiras", "Flamengo", "Cruzeiro", "Grêmio", "Internacional", "Bahia", "Fortaleza", "Athletico", "São Paulo"];

/**
 * Players generated per category. Must comfortably exceed (teams × max per-category
 * roster need) so the draft never runs a category dry and stalls — 64 covers the
 * lobby cap of 8 teams drafting 6 defenders/midfielders each (48), with headroom.
 */
const PER_CAT = 64;

/**
 * Deterministic pool (stable across reloads). Within a category every (first, last)
 * pair is unique — the first-name index cycles and a per-cycle shift on the last
 * name keeps later players distinct — so no two share a name.
 */
function buildPool(): Player[] {
  const players: Player[] = [];
  CATS.forEach((cat, c) => {
    for (let n = 0; n < PER_CAT; n++) {
      const cycle = Math.floor(n / FIRST.length);
      players.push({
        id: `${CAT_ABBR[cat]}-${n}`,
        name: `${FIRST[(n + c * 5) % FIRST.length]} ${LAST[(n * 3 + c * 7 + cycle * 11) % LAST.length]}`,
        cat,
        rating: 72 + ((n * 13 + c * 17) % 22), // 72..93
        club: CLUBS[(n + c * 3) % CLUBS.length],
      });
    }
  });
  return players;
}

export const PLAYER_POOL: Player[] = buildPool();

/** A football-ish name from two seeds (used to flesh out mock-team squads). */
export function mockName(a: number, b: number): string {
  return `${FIRST[Math.abs(a) % FIRST.length]} ${LAST[Math.abs(b) % LAST.length]}`;
}
