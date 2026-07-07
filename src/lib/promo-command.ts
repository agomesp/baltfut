/**
 * Parse a Kick chat message for a promo-view command. Viewers type `!promo` (show
 * the RB Store promos) or `!palpites` (show the palpites) to flip the streamer's
 * captured view — see promo-display's lock rules for who wins.
 *
 * Must be a bang-prefixed standalone token: at a word start and not glued to more
 * letters/digits, so `!promoção`, `!palpiteszinho`, and bare `promo` are NOT
 * commands. Case-insensitive. Returns the first command found, or null.
 */
export type PromoCommand = "promo" | "palpites";

// (^|whitespace) ! word (not followed by another letter/digit, incl. accented).
const CMD_RE = /(?:^|\s)!(promo|palpites)(?![\wÀ-ÿ])/i;

export function parsePromoCommand(message: string): PromoCommand | null {
  const m = CMD_RE.exec(message ?? "");
  return m ? (m[1].toLowerCase() as PromoCommand) : null;
}
