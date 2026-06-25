/**
 * LOCAL EXPERIMENT — maps each WC fixture team to its generic PixelLab craque,
 * batched by kit color (8 craques cover all 48 teams) + skin/hair archetype.
 *
 * The craque is GENERIC and non-identifiable (only the kit color ties it to a
 * team — never a real player). Archetype (A fair+light / B tan+dark / C dark+
 * black) is the representative skin/hair; squads are diverse so it's an approx.
 *
 * Used by the goal/foul cinematic (kick = scored, slide = foul) and the hero.
 * Escalação: 3 generic grayscale bodies (SQUAD_BODIES) reused for every team;
 * only squad-fair is animated so far (generic scorer/fouler fallback).
 */
export type CraqueBase =
  | "england-craque-test"
  | "yellow-craque-test"
  | "red-craque"
  | "blue-craque"
  | "green-craque"
  | "maroon-craque"
  | "orange-craque"
  | "celeste-craque";

export type Archetype = "A" | "B" | "C"; // A fair+light hair · B tan+dark · C dark+black

interface ColorGroup {
  base: CraqueBase;
  label: string;
  /** Teams whose home kit reads this color, with a representative archetype. */
  teams: Record<string, Archetype>;
}

export const COLOR_GROUPS: ColorGroup[] = [
  { base: "england-craque-test", label: "Branco", teams: { ENG: "A", GER: "A", USA: "A", NZL: "A", IRN: "B", IRQ: "B", KSA: "B", JOR: "B", UZB: "B", ALG: "B", SEN: "C", GHA: "C" } },
  { base: "red-craque", label: "Vermelho", teams: { SUI: "A", CZE: "A", NOR: "A", AUT: "A", CRO: "A", BEL: "A", ESP: "B", POR: "B", TUR: "B", TUN: "B", MAR: "B", EGY: "B", PAN: "B", PAR: "B", CAN: "A", KOR: "B" } },
  { base: "blue-craque", label: "Azul", teams: { FRA: "A", JPN: "B", SCO: "A", BIH: "A", CUW: "C", CPV: "C", COD: "C", HAI: "C" } },
  { base: "yellow-craque-test", label: "Amarelo", teams: { BRA: "B", COL: "B", ECU: "B", SWE: "A", AUS: "A", RSA: "C" } },
  { base: "maroon-craque", label: "Bordô", teams: { QAT: "B" } },
  { base: "orange-craque", label: "Laranja", teams: { CIV: "C", NED: "A" } },
  { base: "celeste-craque", label: "Celeste", teams: { URU: "A", ARG: "A" } },
  { base: "green-craque", label: "Verde", teams: { MEX: "B" } },
];

/** FIFA code -> craque base (built from COLOR_GROUPS). */
export const TEAM_CRAQUE: Record<string, CraqueBase> = Object.fromEntries(
  COLOR_GROUPS.flatMap((g) => Object.keys(g.teams).map((code) => [code, g.base])),
);

export function craqueForTeam(code: string): CraqueBase | null {
  return TEAM_CRAQUE[code] ?? null;
}

/**
 * Alternate (change-strip) craque per team, used when BOTH teams in a match map
 * to the same craque color so the two crests don't look identical. Loosely the
 * team's real away-kit color, mapped to one of the 8 available craques.
 */
export const TEAM_CRAQUE_ALT: Partial<Record<string, CraqueBase>> = {
  // Red home → white (or blue) change strip
  SUI: "england-craque-test", CAN: "england-craque-test", MAR: "england-craque-test",
  CZE: "england-craque-test", KOR: "england-craque-test", TUN: "england-craque-test",
  TUR: "england-craque-test", NOR: "england-craque-test", BEL: "england-craque-test",
  PAN: "england-craque-test", AUT: "england-craque-test", EGY: "england-craque-test",
  ESP: "blue-craque", CRO: "blue-craque", PAR: "blue-craque",
  // White home → colored change strip
  ENG: "red-craque", GER: "green-craque", USA: "blue-craque", NZL: "blue-craque",
  SEN: "green-craque", IRQ: "green-craque", KSA: "green-craque", IRN: "red-craque",
  JOR: "red-craque", UZB: "blue-craque", ALG: "green-craque", GHA: "red-craque",
  // Blue home → white change strip
  FRA: "england-craque-test", JPN: "england-craque-test", SCO: "england-craque-test",
  BIH: "england-craque-test", CUW: "england-craque-test", CPV: "england-craque-test",
  COD: "england-craque-test", HAI: "england-craque-test",
  // Yellow home → blue (or white)
  BRA: "blue-craque", COL: "blue-craque", ECU: "blue-craque", SWE: "blue-craque",
  AUS: "england-craque-test", RSA: "england-craque-test",
  // Small color groups
  MEX: "england-craque-test", QAT: "england-craque-test", POR: "england-craque-test",
  CIV: "england-craque-test", NED: "england-craque-test", URU: "england-craque-test", ARG: "england-craque-test",
};

/** Craque bases for both teams, switching one to its alternate if they clash. */
export function resolveCraquePair(home: string, away: string): { home: CraqueBase | null; away: CraqueBase | null } {
  let h = craqueForTeam(home);
  let a = craqueForTeam(away);
  if (h && a && h === a) {
    const altA = TEAM_CRAQUE_ALT[away];
    if (altA && altA !== h) {
      a = altA;
    } else {
      const altH = TEAM_CRAQUE_ALT[home];
      h = altH && altH !== a ? altH : h;
      if (h === a) a = a === "england-craque-test" ? "blue-craque" : "england-craque-test";
    }
  }
  return { home: h, away: a };
}

export interface ClipInfo {
  key: string;
  frames: number;
}
/** Per-craque animation clips (frame counts differ by how each was generated). */
export const CRAQUE_CLIPS: Record<CraqueBase, { hero: ClipInfo; kick: ClipInfo; slide: ClipInfo }> = {
  "england-craque-test": { hero: { key: "hero-idle", frames: 4 }, kick: { key: "goal-kick", frames: 9 }, slide: { key: "slide-foul", frames: 6 } },
  "yellow-craque-test": { hero: { key: "arms-crossed", frames: 5 }, kick: { key: "goal-kick", frames: 5 }, slide: { key: "slide-foul", frames: 6 } },
  "red-craque": { hero: { key: "hero", frames: 5 }, kick: { key: "goal-kick", frames: 5 }, slide: { key: "slide-foul", frames: 6 } },
  "blue-craque": { hero: { key: "hero", frames: 5 }, kick: { key: "goal-kick", frames: 5 }, slide: { key: "slide-foul", frames: 6 } },
  "green-craque": { hero: { key: "hero", frames: 4 }, kick: { key: "goal-kick", frames: 5 }, slide: { key: "slide-foul", frames: 6 } },
  "maroon-craque": { hero: { key: "hero", frames: 4 }, kick: { key: "goal-kick", frames: 5 }, slide: { key: "slide-foul", frames: 6 } },
  "orange-craque": { hero: { key: "hero", frames: 4 }, kick: { key: "goal-kick", frames: 5 }, slide: { key: "slide-foul", frames: 6 } },
  "celeste-craque": { hero: { key: "hero", frames: 5 }, kick: { key: "goal-kick", frames: 5 }, slide: { key: "slide-foul", frames: 6 } },
};

/**
 * Generic grayscale escalação bodies (skin variety), reused for EVERY team's
 * squad wall. Only squad-fair is animated (kick+slide) so far — it's the generic
 * scorer/fouler stand-in when a non-craque player makes the play. The per-member
 * archetype of a real lineup is approximated by these (squads are diverse).
 */
/** Glow color per craque base — used for the escalação backlight. Driven by the
 * RESOLVED craque (alt applied), so two same-color teams glow differently. */
export const CRAQUE_GLOW: Record<CraqueBase, string> = {
  "england-craque-test": "#dfe7ee",
  "red-craque": "#e5343d",
  "blue-craque": "#3a7de8",
  "yellow-craque-test": "#f5c518",
  "green-craque": "#2ecc55",
  "maroon-craque": "#b3324a",
  "orange-craque": "#ff851b",
  "celeste-craque": "#7fd0e8",
};

export const SQUAD_BODIES = ["squad-fair", "squad-tan", "squad-dark"] as const;
export const ANIMATED_SQUAD = "squad-fair"; // the one with kick+slide

/** Clips for the animated generic squad body (same shape as a craque's). */
export const SQUAD_CLIPS = { kick: { key: "goal-kick", frames: 5 }, slide: { key: "slide-foul", frames: 6 } };
