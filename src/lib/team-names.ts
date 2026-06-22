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

// FIFA 3-letter code -> ISO 3166-1 alpha-2 (for regional-indicator flag emoji).
const FIFA_TO_ISO2: Record<string, string> = {
  USA: "US", CAN: "CA", MEX: "MX",
  FRA: "FR", ESP: "ES", POR: "PT", NED: "NL", BEL: "BE", CRO: "HR", ITA: "IT",
  GER: "DE", SUI: "CH", DEN: "DK", AUT: "AT", NOR: "NO", SRB: "RS", UKR: "UA",
  TUR: "TR", CZE: "CZ", BIH: "BA", SWE: "SE", POL: "PL", GRE: "GR", IRL: "IE",
  ARG: "AR", BRA: "BR", URU: "UY", COL: "CO", ECU: "EC", PAR: "PY", PER: "PE", CHI: "CL",
  MAR: "MA", SEN: "SN", EGY: "EG", CIV: "CI", NGA: "NG", ALG: "DZ", TUN: "TN",
  GHA: "GH", CMR: "CM", RSA: "ZA", CPV: "CV", CUW: "CW", HAI: "HT",
  JPN: "JP", KOR: "KR", IRN: "IR", AUS: "AU", KSA: "SA", QAT: "QA", UZB: "UZ",
  JOR: "JO", IRQ: "IQ", PAN: "PA", CRC: "CR", JAM: "JM", HON: "HN", NZL: "NZ", COD: "CD",
};

// England/Scotland/Wales use ISO subdivision tag-sequence flags (no plain ISO2).
const SUBDIVISION: Record<string, string> = { ENG: "gbeng", SCO: "gbsct", WAL: "gbwls" };

function regionalIndicators(iso2: string): string {
  return String.fromCodePoint(
    ...[...iso2.toUpperCase()].map((c) => 0x1f1e6 + (c.charCodeAt(0) - 65)),
  );
}

function subdivisionFlag(sub: string): string {
  const BLACK_FLAG = 0x1f3f4;
  const CANCEL_TAG = 0xe007f;
  const tags = [...sub].map((c) => String.fromCodePoint(0xe0061 + (c.charCodeAt(0) - 97)));
  return String.fromCodePoint(BLACK_FLAG) + tags.join("") + String.fromCodePoint(CANCEL_TAG);
}

/**
 * Flag emoji for a FIFA code, or "" if unknown. Regional-indicator flags render
 * on Apple/Android; Windows shows the 2-letter code instead (known platform
 * limitation). The home-nation flags use subdivision tag sequences.
 */
export function flagEmoji(code: string): string {
  if (SUBDIVISION[code]) return subdivisionFlag(SUBDIVISION[code]);
  const iso2 = FIFA_TO_ISO2[code];
  return iso2 ? regionalIndicators(iso2) : "";
}

// flag-icons (CC0) file base for a FIFA code: ISO2 lowercase, or gb-eng/gb-sct/
// gb-wls for the home nations; "" if unknown. Used for the vendored SVGs in
// public/flags/ (real flag artwork, unlike the emoji which doesn't scale large).
const FIFA_TO_FLAG_SUBDIV: Record<string, string> = { ENG: "gb-eng", SCO: "gb-sct", WAL: "gb-wls" };
export function flagFileBase(code: string): string {
  if (FIFA_TO_FLAG_SUBDIV[code]) return FIFA_TO_FLAG_SUBDIV[code];
  const iso2 = FIFA_TO_ISO2[code];
  return iso2 ? iso2.toLowerCase() : "";
}
