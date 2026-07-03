/**
 * Server-side started-tie lock for bracket palpites. A bracket pick predicts the
 * WINNER of a knockout tie; once that tie's real match has kicked off, the pick is
 * no longer a prediction (the result is known or under way), so cast-bracket must
 * refuse to record it — the UI lock in the browser isn't a security boundary.
 *
 * Rather than reproduce the whole bracket position → match mapping, we use the
 * teams: a pick at round R for team T is dropped iff T is already playing (or has
 * played) its match at round R's stage. Conservative and correct for anti-gaming
 * — you can never newly "predict" a team advancing from a tie already under way.
 *
 * Pure (no network); unit-tested in Node via "@shared/*" and imported by the Deno
 * function directly. Mirrors the client parse: stage = season.slug, state =
 * status.type.state, team = competitor.team.abbreviation.
 */

/** Bracket round index (0..4) → ESPN knockout stage slug. A round with no stage
 *  here (e.g. out of range) is never locked. */
export const STAGE_BY_ROUND = ["round-of-32", "round-of-16", "quarterfinals", "semifinals", "final"] as const;

const KNOCKOUT_STAGES = new Set<string>(STAGE_BY_ROUND);

/** A knockout match reduced to what the lock needs. */
export interface KoMatch {
  stage: string;
  /** "pre" | "in" | "post". */
  state: string;
  /** Team abbreviations as ESPN reports them. */
  home: string;
  away: string;
}

function rec(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : undefined;
}
function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

/** Extract the knockout matches from a raw ESPN scoreboard payload, skipping
 *  non-knockout stages and anything malformed. Pure. */
export function knockoutMatchesFromScoreboard(json: unknown): KoMatch[] {
  const events = rec(json)?.events;
  if (!Array.isArray(events)) return [];
  const out: KoMatch[] = [];
  for (const ev of events) {
    const e = rec(ev);
    if (!e) continue;
    const stage = str(rec(e.season)?.slug) ?? "";
    if (!KNOCKOUT_STAGES.has(stage)) continue;
    const state = str(rec(rec(e.status)?.type)?.state);
    const comp = Array.isArray(e.competitions) ? rec(e.competitions[0]) : undefined;
    const competitors = comp && Array.isArray(comp.competitors) ? comp.competitors : [];
    let home: string | undefined;
    let away: string | undefined;
    for (const c of competitors) {
      const cr = rec(c);
      const abbr = str(rec(cr?.team)?.abbreviation);
      if (!cr || !abbr) continue;
      if (cr.homeAway === "home") home = abbr;
      else if (cr.homeAway === "away") away = abbr;
    }
    if (!state || !home || !away) continue;
    out.push({ stage, state, home, away });
  }
  return out;
}

/** For each stage slug, the set of team abbreviations whose match has already
 *  kicked off (state !== "pre"). Those teams' ties can no longer be predicted. */
export function startedTeamsByStage(matches: KoMatch[]): Record<string, Set<string>> {
  const out: Record<string, Set<string>> = {};
  for (const m of matches) {
    if (m.state === "pre") continue;
    (out[m.stage] ??= new Set<string>()).add(m.home);
    out[m.stage].add(m.away);
  }
  return out;
}

/** Drop bracket picks whose tie has already kicked off (the picked team is in a
 *  started match at that round's stage). Returns only the picks safe to store. */
export function dropStartedPicks(
  picks: Record<string, string>,
  startedByStage: Record<string, Set<string>>,
): Record<string, string> {
  const kept: Record<string, string> = {};
  for (const [key, team] of Object.entries(picks)) {
    const round = Number(key.split("-")[0]);
    const stage = STAGE_BY_ROUND[round];
    if (stage && startedByStage[stage]?.has(team)) continue; // started tie → drop
    kept[key] = team;
  }
  return kept;
}
