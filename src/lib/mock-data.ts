import type { Group, Match, MatchCard, MatchGoal, Team } from "@/lib/espn";
import type { VoteEntry } from "@/lib/votes";

/**
 * Dev-only fixture for visualizing the AO VIVO redesign without Supabase or a real
 * live match. Activated with `?mock=1`. Mirrors the design handoff (ENG 1–1 GHA &
 * COL 2–1 COD live, PAN vs CRO + BIH vs QAT upcoming) plus finished games so the
 * Ranking dos Subs, "pior palpiteiro" and team history all populate. NEVER used in
 * production — page.tsx only reads it when the mock flag is present.
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

function team(code: string, name: string): Team {
  return { id: code, name, abbreviation: code, logo: null };
}

const MIN = 60_000;

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

const goal = (side: MatchGoal["side"], clock: string, scorer: string, penalty = false): MatchGoal => ({ side, clock, scorer, type: "Goal", ownGoal: false, penalty });
const card = (side: MatchCard["side"], clock: string, player: string, kind: MatchCard["kind"] = "yellow"): MatchCard => ({ side, clock, player, kind });
const entry = (matchId: string, username: string, predHome: number, predAway: number): VoteEntry => ({ matchId, league: "fifa.world", username, predHome, predAway, createdAt: "2026-06-20T12:00:00Z" });

// Deterministic 0..99 hash so the generated leaderboard is stable across reloads.
function hash(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 100;
}

const RANKING_USERS = ["ChatGPT", "martineza", "Rodrigo Baltar", "Synced", "Zinnecwb", "Albobajol", "azubu", "chief117", "drakad", "jmello123", "LEMES", "LilJam", "Lu4nt", "Markler", "kahzin", "theuss"];

export function buildMockData(now: number): MockData {
  const iso = (ms: number) => new Date(ms).toISOString();

  const ENG = team("ENG", "Inglaterra"), GHA = team("GHA", "Gana");
  const COL = team("COL", "Colômbia"), COD = team("COD", "RD Congo");
  const PAN = team("PAN", "Panamá"), CRO = team("CRO", "Croácia");
  const BIH = team("BIH", "Bósnia"), QAT = team("QAT", "Catar");
  const SUI = team("SUI", "Suíça"), CAN = team("CAN", "Canadá");
  const KSA = team("KSA", "Arábia Saudita"), JPN = team("JPN", "Japão"), SEN = team("SEN", "Senegal");
  const MAR = team("MAR", "Marrocos"), BEL = team("BEL", "Bélgica"), PER = team("PER", "Peru");

  const liveEngGha = mkMatch({
    id: "mk_eng_gha", home: ENG, away: GHA, startsAt: iso(now - 67 * MIN), state: "in",
    displayClock: "67'", venue: "Foxborough", homeScore: 1, awayScore: 1,
    goals: [goal("home", "23'", "J. Bellingham"), goal("away", "58'", "M. Kudus")],
    cards: [card("away", "41'", "T. Partey"), card("home", "64'", "D. Rice")],
  });
  const liveColCod = mkMatch({
    id: "mk_col_cod", home: COL, away: COD, startsAt: iso(now - 58 * MIN), state: "in",
    displayClock: "58'", venue: "Dallas", homeScore: 2, awayScore: 1,
    goals: [goal("home", "12'", "J. Córdoba"), goal("away", "33'", "Wissa"), goal("home", "51'", "L. Díaz")],
  });

  const upcoming = [
    mkMatch({ id: "mk_pan_cro", home: PAN, away: CRO, startsAt: iso(now + 18 * MIN + 42_000), state: "pre", venue: "Atlanta" }),
    mkMatch({ id: "mk_bih_qat", home: BIH, away: QAT, startsAt: iso(now + 63 * MIN + 15_000), state: "pre", venue: "Los Angeles" }),
    mkMatch({ id: "mk_sui_can", home: SUI, away: CAN, startsAt: iso(now + 140 * MIN), state: "pre", venue: "Vancouver" }),
  ];

  // Finished games (drive ranking + the pre-match "NA COPA" history).
  const fin = (id: string, home: Team, away: Team, hs: number, as: number, daysAgo: number, venue: string): Match =>
    mkMatch({ id, home, away, startsAt: iso(now - daysAgo * 24 * 60 * MIN), state: "post", homeScore: hs, awayScore: as, venue });
  const finished = [
    fin("mk_pan_ksa", PAN, KSA, 2, 1, 9, "Houston"),
    fin("mk_jpn_pan", JPN, PAN, 0, 0, 6, "Kansas City"),
    fin("mk_pan_sen", PAN, SEN, 1, 3, 3, "Atlanta"),
    fin("mk_cro_mar", CRO, MAR, 3, 1, 9, "Miami"),
    fin("mk_cro_bel", CRO, BEL, 1, 1, 6, "Seattle"),
    fin("mk_cro_per", CRO, PER, 2, 0, 3, "Los Angeles"),
    fin("mk_eng_x", ENG, SEN, 2, 0, 4, "Boston"),
    fin("mk_gha_x", GHA, KSA, 1, 0, 4, "Philadelphia"),
  ];

  const matches = [liveEngGha, liveColCod, ...upcoming, ...finished];

  // --- entries -------------------------------------------------------------
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

  // Finished-match palpites → a varied leaderboard (early users score more).
  const finishedEntries: VoteEntry[] = [];
  for (const m of finished) {
    RANKING_USERS.forEach((u, ui) => {
      if (hash(u + m.id) % 5 === 0) return; // not everyone palpitates every game
      const skill = 1 - ui / RANKING_USERS.length;
      const correct = hash(u + "|" + m.id) / 100 < skill * 0.6;
      finishedEntries.push(correct ? entry(m.id, u, m.homeScore!, m.awayScore!) : entry(m.id, u, m.homeScore! + 1, m.awayScore!));
    });
  }

  const entries = [...liveEntries, ...upcomingEntries, ...finishedEntries];
  const voteCounts: Record<string, number> = {};
  for (const e of entries) voteCounts[e.matchId] = (voteCounts[e.matchId] ?? 0) + 1;

  const groupRow = (code: string, name: string) => ({ rank: 1, code, name, played: 3, gd: "+1", points: 6, advanced: true });
  const groups: Group[] = [
    { letter: "L", name: "Group L", rows: [groupRow("ENG", "Inglaterra"), groupRow("GHA", "Gana")] },
    { letter: "H", name: "Group H", rows: [groupRow("COL", "Colômbia"), groupRow("COD", "RD Congo")] },
    { letter: "F", name: "Group F", rows: [groupRow("PAN", "Panamá"), groupRow("CRO", "Croácia"), groupRow("KSA", "Arábia Saudita"), groupRow("SEN", "Senegal")] },
    { letter: "C", name: "Group C", rows: [groupRow("BIH", "Bósnia"), groupRow("QAT", "Catar")] },
  ];

  const promos: MockPromo[] = [
    { product: "Placa de Vídeo MSI GeForce RTX 5060", price: "R$ 2.429", store: "KABUM", link: "https://t.me/rbstorenet", image: null, coupon: null },
    { product: "Placa de Vídeo XFX Mercury RX 9070 XT", price: "R$ 4.589", store: "KABUM", link: "https://t.me/rbstorenet", image: null, coupon: null },
    { product: "Teclado Gamer Sem Fio Logitech G PRO", price: "R$ 1.199", store: "AMAZON", link: "https://t.me/rbstorenet", image: null, coupon: null },
    { product: "Monitor 27 4K U27B3A HDR10", price: "R$ 972", store: "SHOPEE", link: "https://t.me/rbstorenet", image: null, coupon: null },
    { product: "SSD NVMe 2TB Kingston KC3000", price: "R$ 749", store: "KABUM", link: "https://t.me/rbstorenet", image: null, coupon: null },
    { product: "Headset HyperX Cloud III Wireless", price: "R$ 689", store: "AMAZON", link: "https://t.me/rbstorenet", image: null, coupon: null },
  ];

  return { matches, entries, voteCounts, groups, promos };
}
