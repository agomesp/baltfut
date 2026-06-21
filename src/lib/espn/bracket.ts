export interface BracketSlot {
  a: string;
  b: string;
}

export interface BracketColumn {
  label: string;
  matches: BracketSlot[];
}

/**
 * Schematic knockout bracket (Round of 32 -> Final). Slots are placeholders
 * ("1A", "2B", "3·1", "W1"…) that resolve once the group stage finishes — the
 * design renders this as a static diagram, so no live data is needed.
 */
export function buildBracket(groupLetters: string[]): BracketColumn[] {
  const seeds: string[] = [];
  groupLetters.forEach((l) => seeds.push("1" + l)); // group winners
  groupLetters.forEach((l) => seeds.push("2" + l)); // runners-up
  for (let i = 1; i <= 8; i++) seeds.push("3·" + i); // best third-placed

  const r32: BracketSlot[] = [];
  for (let i = 0; i < 16; i++) {
    r32.push({ a: seeds[i * 2] ?? "—", b: seeds[i * 2 + 1] ?? "—" });
  }

  const mk = (prefix: string, n: number): BracketSlot[] =>
    Array.from({ length: n }, (_, i) => ({
      a: prefix + (i * 2 + 1),
      b: prefix + (i * 2 + 2),
    }));

  return [
    { label: "32-avos", matches: r32 },
    { label: "Oitavas", matches: mk("V", 8) },
    { label: "Quartas", matches: mk("R", 4) },
    { label: "Semifinais", matches: mk("Q", 2) },
    { label: "Final", matches: [{ a: "S1", b: "S2" }] },
  ];
}
