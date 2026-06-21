/**
 * Brazilian-Portuguese country names keyed by FIFA 3-letter code. ESPN returns
 * English names; we localize the ones we know and fall back to ESPN's name for
 * anything unmapped (so the app never shows a blank team).
 */
const PT_BR: Record<string, string> = {
  // Hosts + UEFA
  USA: "Estados Unidos",
  CAN: "Canadá",
  MEX: "México",
  FRA: "França",
  ESP: "Espanha",
  ENG: "Inglaterra",
  POR: "Portugal",
  NED: "Países Baixos",
  BEL: "Bélgica",
  CRO: "Croácia",
  ITA: "Itália",
  GER: "Alemanha",
  SUI: "Suíça",
  DEN: "Dinamarca",
  AUT: "Áustria",
  NOR: "Noruega",
  SRB: "Sérvia",
  UKR: "Ucrânia",
  TUR: "Turquia",
  CZE: "Tchéquia",
  BIH: "Bósnia e Herzegovina",
  SCO: "Escócia",
  WAL: "País de Gales",
  SWE: "Suécia",
  POL: "Polônia",
  GRE: "Grécia",
  IRL: "Irlanda",
  // CONMEBOL
  ARG: "Argentina",
  BRA: "Brasil",
  URU: "Uruguai",
  COL: "Colômbia",
  ECU: "Equador",
  PAR: "Paraguai",
  PER: "Peru",
  CHI: "Chile",
  // CAF
  MAR: "Marrocos",
  SEN: "Senegal",
  EGY: "Egito",
  CIV: "Costa do Marfim",
  NGA: "Nigéria",
  ALG: "Argélia",
  TUN: "Tunísia",
  GHA: "Gana",
  CMR: "Camarões",
  RSA: "África do Sul",
  CPV: "Cabo Verde",
  CUW: "Curaçao",
  HAI: "Haiti",
  // AFC
  JPN: "Japão",
  KOR: "Coreia do Sul",
  IRN: "Irã",
  AUS: "Austrália",
  KSA: "Arábia Saudita",
  QAT: "Catar",
  UZB: "Uzbequistão",
  JOR: "Jordânia",
  IRQ: "Iraque",
  // CONCACAF + OFC
  PAN: "Panamá",
  CRC: "Costa Rica",
  JAM: "Jamaica",
  HON: "Honduras",
  NZL: "Nova Zelândia",
  // CAF (cont.)
  COD: "RD Congo",
};

/** Localized team name for a FIFA code, or the provided fallback (ESPN's name). */
export function teamNamePt(code: string, fallback: string): string {
  return PT_BR[code] ?? fallback;
}
