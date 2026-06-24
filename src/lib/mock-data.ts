import type { Group, Match, MatchCard, MatchGoal, StandingRow, Team } from "@/lib/espn";
import type { VoteEntry } from "@/lib/votes";
import { teamNamePt } from "@/lib/team-names";

/**
 * Dev-only fixture for visualizing the whole app (live + the JOGOS/GRUPOS/
 * RESULTADOS/CHAVEAMENTO views) without Supabase or a real live match. Activated
 * with `?mock=1`: 12 full groups, a multi-day schedule, results, two live matches
 * and seeded palpites so the ranking, consensus and team history all populate.
 * NEVER used in production — page.tsx only reads it when the mock flag is present.
 */

export interface MockData {
  matches: Match[];
  entries: VoteEntry[];
  voteCounts: Record<string, number>;
  groups: Group[];
  promos: MockPromo[];
}

export interface MockPromo {
  product: string;
  price: string | null;
  link: string;
  image: string | null;
  store: string | null;
  coupon: string | null;
}

const T = (code: string): Team => ({ id: code, name: teamNamePt(code, code), abbreviation: code, logo: null });

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

function mkMatch(p: Partial<Match> & { id: string; home: Team; away: Team; startsAt: string; state: Match["state"] }): Match {
  return {
    league: "fifa.world",
    name: `${p.home.name} v ${p.away.name}`,
    shortName: `${p.home.abbreviation} @ ${p.away.abbreviation}`,
    isLive: p.state === "in",
    statusDetail: p.state === "post" ? "FT" : p.state === "in" ? p.displayClock ?? "" : "",
    displayClock: null,
    venue: null,
    homeScore: null,
    awayScore: null,
    goals: [],
    cards: [],
    ...p,
  };
}

const goal = (side: MatchGoal["side"], clock: string, scorer: string): MatchGoal => ({ side, clock, scorer, type: "Goal", ownGoal: false, penalty: false });
const card = (side: MatchCard["side"], clock: string, player: string): MatchCard => ({ side, clock, player, kind: "yellow" });
const entry = (matchId: string, username: string, predHome: number, predAway: number): VoteEntry => ({ matchId, league: "fifa.world", username, predHome, predAway, createdAt: "2026-06-20T12:00:00Z" });

function hash(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 100;
}

const RANKING_USERS = ["ChatGPT", "martineza", "Rodrigo Baltar", "Synced", "Zinnecwb", "Albobajol", "azubu", "chief117", "drakad", "jmello123", "LEMES", "LilJam", "Lu4nt", "Markler", "kahzin", "theuss"];

// 12 groups with standings (rank, code, gd, pts). played fixed at 2 (display uses SG/PTS only).
const GROUP_TABLE: Record<string, [number, string, string, number][]> = {
  A: [[1, "MEX", "+3", 6], [2, "KOR", "0", 3], [3, "CZE", "-1", 1], [4, "RSA", "-2", 1]],
  B: [[1, "CAN", "+6", 4], [2, "SUI", "+3", 4], [3, "BIH", "-3", 1], [4, "QAT", "-6", 1]],
  C: [[1, "BRA", "+3", 4], [2, "MAR", "+1", 4], [3, "SCO", "0", 3], [4, "HAI", "-4", 0]],
  D: [[1, "USA", "+5", 6], [2, "AUS", "0", 3], [3, "PAR", "-2", 3], [4, "TUR", "-3", 0]],
  E: [[1, "GER", "+7", 6], [2, "CIV", "0", 3], [3, "ECU", "-1", 1], [4, "CUW", "-6", 1]],
  F: [[1, "JPN", "+4", 4], [2, "NED", "+4", 4], [3, "SWE", "0", 3], [4, "TUN", "-8", 0]],
  G: [[1, "EGY", "+2", 4], [2, "BEL", "0", 2], [3, "IRN", "0", 2], [4, "NZL", "-2", 1]],
  H: [[1, "ESP", "+4", 4], [2, "CPV", "0", 2], [3, "URU", "0", 2], [4, "KSA", "-4", 1]],
  I: [[1, "FRA", "+5", 6], [2, "NOR", "+4", 6], [3, "SEN", "-3", 0], [4, "IRQ", "-6", 0]],
  J: [[1, "ARG", "+4", 6], [2, "ALG", "+1", 4], [3, "AUT", "-2", 1], [4, "JOR", "-3", 0]],
  K: [[1, "POR", "+5", 6], [2, "COL", "+1", 4], [3, "COD", "-1", 1], [4, "UZB", "-5", 0]],
  L: [[1, "CRO", "+2", 4], [2, "ENG", "+1", 4], [3, "GHA", "0", 2], [4, "PAN", "-3", 1]],
};

function buildGroups(): Group[] {
  return Object.entries(GROUP_TABLE).map(([letter, rows]) => ({
    letter,
    name: `Group ${letter}`,
    rows: rows.map(([rank, code, gd, points]): StandingRow => ({ rank, code, name: teamNamePt(code, code), played: 2, gd, points, advanced: rank <= 2 })),
  }));
}

export function buildMockData(now: number): MockData {
  const iso = (ms: number) => new Date(ms).toISOString();

  // --- live --------------------------------------------------------------
  const liveEngGha = mkMatch({
    id: "mk_eng_gha", home: T("ENG"), away: T("GHA"), startsAt: iso(now - 67 * MIN), state: "in",
    displayClock: "67'", venue: "Foxborough", homeScore: 1, awayScore: 1,
    goals: [goal("home", "23'", "J. Bellingham"), goal("away", "58'", "M. Kudus")],
    cards: [card("away", "41'", "T. Partey"), card("home", "64'", "D. Rice")],
  });
  const liveColCod = mkMatch({
    id: "mk_col_cod", home: T("COL"), away: T("COD"), startsAt: iso(now - 58 * MIN), state: "in",
    displayClock: "58'", venue: "Dallas", homeScore: 2, awayScore: 1,
    goals: [goal("home", "12'", "J. Córdoba"), goal("away", "33'", "Wissa"), goal("home", "51'", "L. Díaz")],
  });

  // --- upcoming (JOGOS) --------------------------------------------------
  const up = (id: string, h: string, a: string, offset: number, venue: string) =>
    mkMatch({ id, home: T(h), away: T(a), startsAt: iso(now + offset), state: "pre", venue });
  const upcoming = [
    up("mk_pan_cro", "PAN", "CRO", 18 * MIN + 42_000, "Atlanta"),
    up("mk_bih_qat", "BIH", "QAT", 63 * MIN + 15_000, "Seattle"),
    up("mk_sui_can", "SUI", "CAN", 2 * HOUR, "Vancouver"),
    up("mk_mar_hai", "MAR", "HAI", 4 * HOUR, "Atlanta"),
    up("mk_sco_bra", "SCO", "BRA", 5 * HOUR, "Miami Gardens"),
    up("mk_cze_mex", "CZE", "MEX", 7 * HOUR, "Mexico City"),
    up("mk_rsa_kor", "RSA", "KOR", 8 * HOUR, "Guadalajara"),
    up("mk_cuw_civ", "CUW", "CIV", DAY + HOUR, "East Rutherford"),
    up("mk_ecu_ger", "ECU", "GER", DAY + HOUR, "Kansas City"),
    up("mk_ned_swe", "NED", "SWE", DAY + 4 * HOUR, "Los Angeles"),
    up("mk_jpn_tun", "JPN", "TUN", DAY + 4 * HOUR, "Toronto"),
  ];

  // --- finished (RESULTADOS + ranking + team history) --------------------
  const fin = (id: string, h: string, a: string, hs: number, as: number, ago: number, venue: string) =>
    mkMatch({ id, home: T(h), away: T(a), startsAt: iso(now - ago), state: "post", homeScore: hs, awayScore: as, venue });
  const finished = [
    fin("mk_por_uzb", "POR", "UZB", 5, 0, DAY, "Houston"),
    fin("mk_jor_alg", "JOR", "ALG", 1, 2, DAY, "Santa Clara"),
    fin("mk_nor_sen", "NOR", "SEN", 3, 2, 2 * DAY, "East Rutherford"),
    fin("mk_fra_irq", "FRA", "IRQ", 3, 0, 2 * DAY, "Philadelphia"),
    fin("mk_arg_aut", "ARG", "AUT", 2, 0, 2 * DAY, "Arlington"),
    fin("mk_nzl_egy", "NZL", "EGY", 1, 3, 3 * DAY, "Vancouver"),
    fin("mk_uru_cpv", "URU", "CPV", 2, 2, 3 * DAY, "Miami Gardens"),
    // team-history drivers for the pre-match "NA COPA" columns
    fin("mk_pan_ksa", "PAN", "KSA", 2, 1, 9 * DAY, "Houston"),
    fin("mk_jpn_pan", "JPN", "PAN", 0, 0, 6 * DAY, "Kansas City"),
    fin("mk_pan_sen", "PAN", "SEN", 1, 3, 4 * DAY, "Atlanta"),
    fin("mk_cro_mar", "CRO", "MAR", 3, 1, 9 * DAY, "Miami"),
    fin("mk_cro_bel", "CRO", "BEL", 1, 1, 6 * DAY, "Seattle"),
    fin("mk_cro_per", "CRO", "PER", 2, 0, 4 * DAY, "Los Angeles"),
  ];

  const matches = [liveEngGha, liveColCod, ...upcoming, ...finished];

  // --- entries -----------------------------------------------------------
  const liveEntries: VoteEntry[] = [
    entry("mk_eng_gha", "LilJam", 1, 1), entry("mk_eng_gha", "agomesp", 1, 2), entry("mk_eng_gha", "drakad", 4, 1),
    entry("mk_eng_gha", "Kaioforeal", 2, 1), entry("mk_eng_gha", "AMINZEIRA", 3, 1), entry("mk_eng_gha", "MarleySR", 2, 3),
    entry("mk_eng_gha", "Niko", 0, 0), entry("mk_eng_gha", "jmello123", 2, 0), entry("mk_eng_gha", "wiillpac", 3, 0),
    entry("mk_col_cod", "martineza", 2, 1), entry("mk_col_cod", "Synced", 3, 1), entry("mk_col_cod", "azubu", 1, 1),
    entry("mk_col_cod", "ChatGPT", 2, 1), entry("mk_col_cod", "drakad", 2, 2),
  ];
  const panSeed: [string, number, number][] = [
    ["Rodrigo Baltar", 1, 2], ["Synced", 0, 1], ["martineza", 2, 2], ["azubu", 1, 1], ["chief117", 0, 2], ["drakad", 2, 1], ["LilJam", 1, 3],
    ["Zinnecwb", 1, 0], ["Albobajol", 2, 3], ["LEMES", 0, 0], ["Kaioforeal", 3, 1], ["AMINZEIRA", 1, 1], ["wiillpac", 2, 2], ["Markler", 0, 1],
  ];
  const bihSeed: [string, number, number][] = [
    ["Synced", 2, 0], ["martineza", 1, 1], ["azubu", 0, 0], ["drakad", 2, 1], ["LilJam", 1, 2], ["chief117", 3, 1], ["Zinnecwb", 0, 1], ["Albobajol", 1, 1],
  ];
  const upcomingEntries = [
    ...panSeed.map(([u, h, a]) => entry("mk_pan_cro", u, h, a)),
    ...bihSeed.map(([u, h, a]) => entry("mk_bih_qat", u, h, a)),
  ];

  const finishedEntries: VoteEntry[] = [];
  for (const m of finished) {
    RANKING_USERS.forEach((u, ui) => {
      if (hash(u + m.id) % 5 === 0) return;
      const skill = 1 - ui / RANKING_USERS.length;
      const correct = hash(u + "|" + m.id) / 100 < skill * 0.6;
      finishedEntries.push(correct ? entry(m.id, u, m.homeScore!, m.awayScore!) : entry(m.id, u, m.homeScore! + 1, m.awayScore!));
    });
  }

  const entries = [...liveEntries, ...upcomingEntries, ...finishedEntries];
  const voteCounts: Record<string, number> = {};
  for (const e of entries) voteCounts[e.matchId] = (voteCounts[e.matchId] ?? 0) + 1;

  const promos: MockPromo[] = [
    { product: "Placa de Vídeo MSI GeForce RTX 5060", price: "R$ 2.429", store: "KABUM", link: "https://t.me/rbstorenet", image: null, coupon: null },
    { product: "Placa de Vídeo XFX Mercury RX 9070 XT", price: "R$ 4.589", store: "KABUM", link: "https://t.me/rbstorenet", image: null, coupon: null },
    { product: "Teclado Gamer Sem Fio Logitech G PRO", price: "R$ 1.199", store: "AMAZON", link: "https://t.me/rbstorenet", image: null, coupon: null },
    { product: "Monitor 27 4K U27B3A HDR10", price: "R$ 972", store: "SHOPEE", link: "https://t.me/rbstorenet", image: null, coupon: null },
    { product: "SSD NVMe 2TB Kingston KC3000", price: "R$ 749", store: "KABUM", link: "https://t.me/rbstorenet", image: null, coupon: null },
    { product: "Headset HyperX Cloud III Wireless", price: "R$ 689", store: "AMAZON", link: "https://t.me/rbstorenet", image: null, coupon: null },
  ];

  return { matches, entries, voteCounts, groups: buildGroups(), promos };
}
