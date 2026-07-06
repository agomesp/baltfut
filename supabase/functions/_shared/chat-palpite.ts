/**
 * Parse a Kick/chat message into a score palpite — or `null` when it isn't one.
 *
 * The hard part is NOT reading the numbers; it's telling a real palpite ("2x1
 * Brasil") apart from prose that merely mentions a scoreline ("no 7x1 ao menos a
 * gente tava na semifinal"). A message only counts when it IS a scoreline,
 * optionally wrapped by the match's own two teams — anything else is rejected.
 *
 * Orientation follows how Brazilians actually type it:
 *   • bare score        → the FIRST number is the mandante (home).      "2x1"        → 2–1
 *   • ONE team named    → that team is the WINNER (takes the higher).   "2x1 Noruega"→ 1–2
 *   • BOTH teams named  → positional by order (left team = left number). "NOR 2x1 BRA"→ 1–2
 *
 * Pure TS (no runtime globals) so it runs in the bot, in Node tests via
 * "@shared/*", and in the Deno `cast-vote` function alike.
 */

export interface TeamRef {
  /** FIFA-style abbreviation, e.g. "BRA". */
  abbr: string;
  /** Display name, e.g. "Brasil" (multi-word names like "Coreia do Sul" ok). */
  name: string;
}

export interface ChatPalpite {
  /** Predicted goals for the HOME team (predHome). */
  home: number;
  /** Predicted goals for the AWAY team (predAway). */
  away: number;
}

// A single-digit score with x / × / : / - / – or "a" ("2 a 1") as the separator,
// NOT glued to a longer number (so "10x1", a "2025-01" date, or "às 21a30" never
// misparse into a bogus score).
const SCORE_RE = /(?<!\d)(\d)\s*(?:[x×:–-]|a)\s*(\d)(?!\d)/;
// Directional filler that may sit next to the score without disqualifying it.
const CONNECTORS = new Set(["pro", "pra", "para"]);
// Legit palpites carry at most ~two team mentions (a couple more for multi-word
// names). More words than this ⇒ it's a sentence, not a palpite.
const MAX_WORDS = 4;

/** Does `word` name `team` — by abbreviation, or any token of its name (prefix-
 *  matched so "br"→Brasil, "nor"→Noruega, "coreia"→Coreia do Sul all hit)? */
function refersTo(word: string, team: TeamRef): boolean {
  if (word.length < 2) return false;
  const abbr = team.abbr.toLowerCase();
  if (word === abbr || abbr.startsWith(word) || word.startsWith(abbr)) return true;
  return team.name
    .toLowerCase()
    .split(/\s+/)
    .some((t) => t.length >= 2 && (t === word || t.startsWith(word) || word.startsWith(t)));
}

export function parseChatPalpite(message: string, home: TeamRef, away: TeamRef): ChatPalpite | null {
  const clean = message
    .replace(/\[emote:[^\]]*\]/g, " ") // Kick emote tokens
    .replace(/\p{Extended_Pictographic}/gu, " ") // emoji
    .toLowerCase();

  const m = clean.match(SCORE_RE);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);

  // Every word left around the score (≥2 letters, connectors aside) must be one of
  // THIS match's two teams — otherwise it's prose that happens to contain a score.
  const words = clean.replace(m[0], " ").split(/[^a-zà-ÿ]+/i).filter((w) => w.length >= 2);
  const meaningful = words.filter((w) => !CONNECTORS.has(w));
  if (meaningful.length > MAX_WORDS) return null;
  if (!meaningful.every((w) => refersTo(w, home) || refersTo(w, away))) return null;

  const homeWord = words.find((w) => refersTo(w, home)) ?? null;
  const awayWord = words.find((w) => refersTo(w, away)) ?? null;

  // Bare score → the first number is the mandante (home).
  if (!homeWord && !awayWord) return { home: a, away: b };

  // Both teams named → orient by their order around the score (left team = left number).
  if (homeWord && awayWord) {
    return clean.indexOf(homeWord) < clean.indexOf(awayWord) ? { home: a, away: b } : { home: b, away: a };
  }

  // Exactly one team named → it's the WINNER, so it takes the higher score.
  if (a === b) return { home: a, away: b }; // a draw has no winner; the name is moot
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  return homeWord ? { home: hi, away: lo } : { home: lo, away: hi };
}
