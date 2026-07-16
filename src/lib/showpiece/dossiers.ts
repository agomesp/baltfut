import type { Match, MatchGoal, MatchState, Team } from "@/lib/espn";

/**
 * Showpiece data for the two marquee fixtures — the FINAL (Argentina × Spain) and
 * the THIRD-PLACE match (France × England). Bespoke "dossiers" (colors, star,
 * coach, knockout path, stats) drive a fully-revamped, dramatic match view. All
 * mock/local — for design review before wiring to real ESPN data.
 */

// ---------------------------------------------------------------------------
// Themes — a completely different palette from the app's usual pitch-green.
// ---------------------------------------------------------------------------

export interface ShowpieceTheme {
  key: "final" | "third";
  kicker: string;
  title: string;
  subtitle: string;
  /** Marquee metal — championship gold vs bronze. */
  metal: string;
  metalDeep: string;
  metalSoft: string;
  /** Full-page background + vignette. */
  pageBg: string;
  glow: string;
  trophy: string;
}

export const FINAL_THEME: ShowpieceTheme = {
  key: "final",
  kicker: "COPA DO MUNDO 2026 · MÉXICO · EUA · CANADÁ",
  title: "A GRANDE FINAL",
  subtitle: "90 minutos entre a glória e o vazio",
  metal: "#ffd76a",
  metalDeep: "#e8b53a",
  metalSoft: "rgba(255,215,106,0.14)",
  pageBg: "radial-gradient(1400px 900px at 50% -20%, #241a3d 0%, #120c26 42%, #060409 100%)",
  glow: "rgba(255,199,89,0.55)",
  trophy: "🏆",
};

export const THIRD_THEME: ShowpieceTheme = {
  key: "third",
  kicker: "COPA DO MUNDO 2026 · DISPUTA DE 3º LUGAR",
  title: "A BATALHA DO BRONZE",
  subtitle: "Orgulho, redenção e a última dança",
  metal: "#e59b63",
  metalDeep: "#bd7040",
  metalSoft: "rgba(205,127,79,0.14)",
  pageBg: "radial-gradient(1400px 900px at 50% -20%, #2a1d16 0%, #1a1109 44%, #070503 100%)",
  glow: "rgba(205,127,79,0.5)",
  trophy: "🥉",
};

// ---------------------------------------------------------------------------
// Team dossiers
// ---------------------------------------------------------------------------

export interface PathLeg {
  round: string;
  opp: string;
  score: string;
  won: boolean;
}

export interface Dossier {
  code: string;
  /** pt-BR name. */
  name: string;
  nickname: string;
  /** Primary + secondary national colors driving the team half. */
  primary: string;
  secondary: string;
  ink: string;
  star: { name: string; pos: string };
  coach: string;
  fifaRank: number;
  path: PathLeg[];
  koGoalsFor: number;
  koGoalsAgainst: number;
  tagline: string;
}

export const DOSSIERS: Record<string, Dossier> = {
  ARG: {
    code: "ARG",
    name: "Argentina",
    nickname: "La Albiceleste",
    primary: "#5aa9ec",
    secondary: "#eaf4ff",
    ink: "#06263f",
    star: { name: "Julián Álvarez", pos: "CENTROAVANTE" },
    coach: "Lionel Scaloni",
    fifaRank: 1,
    path: [
      { round: "32-AVOS", opp: "CRC", score: "4–0", won: true },
      { round: "OITAVAS", opp: "MEX", score: "2–1", won: true },
      { round: "QUARTAS", opp: "CRO", score: "3–2", won: true },
      { round: "SEMIFINAL", opp: "ENG", score: "1–0", won: true },
    ],
    koGoalsFor: 10,
    koGoalsAgainst: 3,
    tagline: "Os campeões defendem a coroa.",
  },
  ESP: {
    code: "ESP",
    name: "Espanha",
    nickname: "La Roja",
    primary: "#e5443b",
    secondary: "#ffcf4d",
    ink: "#2a0705",
    star: { name: "Lamine Yamal", pos: "PONTA DIREITA" },
    coach: "Luis de la Fuente",
    fifaRank: 2,
    path: [
      { round: "32-AVOS", opp: "JPN", score: "3–1", won: true },
      { round: "OITAVAS", opp: "SUI", score: "2–0", won: true },
      { round: "QUARTAS", opp: "GER", score: "1–1 (5–4p)", won: true },
      { round: "SEMIFINAL", opp: "FRA", score: "2–1", won: true },
    ],
    koGoalsFor: 8,
    koGoalsAgainst: 3,
    tagline: "A Fúria quer o mundo desde 2010.",
  },
  FRA: {
    code: "FRA",
    name: "França",
    nickname: "Les Bleus",
    primary: "#3b6fd0",
    secondary: "#f4f7ff",
    ink: "#04193f",
    star: { name: "Kylian Mbappé", pos: "CENTROAVANTE" },
    coach: "Didier Deschamps",
    fifaRank: 3,
    path: [
      { round: "32-AVOS", opp: "SEN", score: "3–0", won: true },
      { round: "OITAVAS", opp: "POR", score: "2–1", won: true },
      { round: "QUARTAS", opp: "NED", score: "2–0", won: true },
      { round: "SEMIFINAL", opp: "ESP", score: "1–2", won: false },
    ],
    koGoalsFor: 8,
    koGoalsAgainst: 3,
    tagline: "Um tropeço na semi. Resta o bronze.",
  },
  ENG: {
    code: "ENG",
    name: "Inglaterra",
    nickname: "Three Lions",
    primary: "#ec3f52",
    secondary: "#f2f6ff",
    ink: "#2a060c",
    star: { name: "Jude Bellingham", pos: "MEIA-ATACANTE" },
    coach: "Thomas Tuchel",
    fifaRank: 4,
    path: [
      { round: "32-AVOS", opp: "ECU", score: "2–0", won: true },
      { round: "OITAVAS", opp: "USA", score: "3–1", won: true },
      { round: "QUARTAS", opp: "BRA", score: "1–0", won: true },
      { round: "SEMIFINAL", opp: "ARG", score: "0–1", won: false },
    ],
    koGoalsFor: 6,
    koGoalsAgainst: 2,
    tagline: "It's coming home… pelo menos o bronze.",
  },
};

// ---------------------------------------------------------------------------
// Match builders
// ---------------------------------------------------------------------------

function team(code: string): Team {
  return { id: `mock-${code}`, name: DOSSIERS[code].name, abbreviation: code, logo: null };
}

function goal(side: "home" | "away", clock: string, scorer: string, penalty = false): MatchGoal {
  return { side, clock, scorer, type: penalty ? "Penalty - Scored" : "Goal", ownGoal: false, penalty };
}

interface BuildOpts {
  state: MatchState;
  kickoffMs: number;
  homeScore?: number;
  awayScore?: number;
  clock?: string;
  goals?: MatchGoal[];
  venue: string;
  stage: string;
}

function buildMatch(homeCode: string, awayCode: string, o: BuildOpts): Match {
  return {
    id: `showpiece-${homeCode}-${awayCode}`,
    league: "fifa.world",
    stage: o.stage,
    name: `${DOSSIERS[awayCode].name} at ${DOSSIERS[homeCode].name}`,
    shortName: `${awayCode} @ ${homeCode}`,
    startsAt: new Date(o.kickoffMs).toISOString(),
    state: o.state,
    isLive: o.state === "in",
    statusDetail: o.state === "in" ? (o.clock ?? "AO VIVO") : o.state === "post" ? "FIM" : "",
    displayClock: o.state === "in" ? (o.clock ?? null) : null,
    venue: o.venue,
    home: team(homeCode),
    away: team(awayCode),
    homeScore: o.homeScore ?? null,
    awayScore: o.awayScore ?? null,
    homeShootout: null,
    awayShootout: null,
    goals: o.goals ?? [],
    cards: [],
  };
}

export interface Scenario {
  key: string;
  theme: ShowpieceTheme;
  match: Match;
  home: Dossier;
  away: Dossier;
}

/** The four preview scenarios, with kickoffs relative to `nowMs` so the pre-match
 *  countdown always reads sensibly. */
export function showpieceScenarios(nowMs: number): Record<string, Scenario> {
  const FINAL_VENUE = "Estádio Azteca · Cidade do México";
  const THIRD_VENUE = "MetLife Stadium · Nova Jersey";

  return {
    "final-pre": {
      key: "final-pre",
      theme: FINAL_THEME,
      home: DOSSIERS.ARG,
      away: DOSSIERS.ESP,
      match: buildMatch("ARG", "ESP", { state: "pre", kickoffMs: nowMs + 135 * 60_000, venue: FINAL_VENUE, stage: "final" }),
    },
    "final-live": {
      key: "final-live",
      theme: FINAL_THEME,
      home: DOSSIERS.ARG,
      away: DOSSIERS.ESP,
      match: buildMatch("ARG", "ESP", {
        state: "in",
        kickoffMs: nowMs - 73 * 60_000,
        homeScore: 1,
        awayScore: 2,
        clock: "73'",
        venue: FINAL_VENUE,
        stage: "final",
        goals: [
          goal("away", "21'", "Lamine Yamal"),
          goal("home", "34'", "Julián Álvarez"),
          goal("away", "68'", "Mikel Merino"),
        ],
      }),
    },
    "third-pre": {
      key: "third-pre",
      theme: THIRD_THEME,
      home: DOSSIERS.FRA,
      away: DOSSIERS.ENG,
      match: buildMatch("FRA", "ENG", { state: "pre", kickoffMs: nowMs + 45 * 60_000, venue: THIRD_VENUE, stage: "third-place" }),
    },
    "third-live": {
      key: "third-live",
      theme: THIRD_THEME,
      home: DOSSIERS.FRA,
      away: DOSSIERS.ENG,
      match: buildMatch("FRA", "ENG", {
        state: "in",
        kickoffMs: nowMs - 61 * 60_000,
        homeScore: 2,
        awayScore: 1,
        clock: "61'",
        venue: THIRD_VENUE,
        stage: "third-place",
        goals: [
          goal("home", "12'", "Kylian Mbappé"),
          goal("away", "40'", "Harry Kane", true),
          goal("home", "55'", "Kylian Mbappé"),
        ],
      }),
    },
  };
}
