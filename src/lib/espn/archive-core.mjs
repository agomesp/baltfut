/**
 * Pure transforms for the ESPN archive, shared by the Node snapshot script and
 * the app's tests (the `.mjs` + parity-test convention this repo already uses
 * for the AI palpite model).
 *
 * These deliberately do almost nothing: the archive stores ESPN's RAW payloads,
 * so the only job here is to lift a few shallow, stable fields out for indexing
 * and to decide which matches still need fetching. All structural interpretation
 * stays in the app's zod-validated parser, which reads the raw blob back — see
 * the migration for why.
 */

/** Shallow read; ESPN sometimes omits nested objects entirely. */
const state = (e) => e?.status?.type?.state ?? null;

/**
 * One archive row per ESPN event. `raw` is the untouched event object, so
 * nothing ESPN sent is discarded — including fields the app doesn't parse yet.
 */
export function buildMatchRows(json, league) {
  const rows = [];
  for (const e of json?.events ?? []) {
    if (!e?.id) continue;
    rows.push({
      match_id: String(e.id),
      league,
      // ESPN's ISO kickoff. Null rather than a guess when absent — the column is
      // only an index, and the truth stays in `raw`.
      starts_at: typeof e.date === "string" ? e.date : null,
      state: state(e),
      raw: e,
    });
  }
  return rows;
}

/**
 * Which matches still need their summary (lineups/subs) fetched.
 *
 * Summaries are one HTTP request each, so refetching all 104 every hour would be
 * both slow and rude to a free endpoint. A finished match's summary never
 * changes again, so once stored it is skipped forever; unfinished matches are
 * refetched because their lineups are still filling in.
 */
export function summariesToFetch(rows, storedFinishedIds) {
  const stored = storedFinishedIds instanceof Set ? storedFinishedIds : new Set(storedFinishedIds ?? []);
  return rows
    .filter((r) => r.state === "post" || r.state === "in")
    .filter((r) => !(r.state === "post" && stored.has(r.match_id)))
    .map((r) => r.match_id);
}

/** Rows whose scores are worth keeping in `match_results` too (finished only). */
export function finishedCount(rows) {
  return rows.filter((r) => r.state === "post").length;
}

/**
 * The slice of a match summary the app actually consumes.
 *
 * `parseLineups` reads exactly two top-level keys — `rosters` (the XI) and
 * `keyEvents` (substitutions). A full summary is ~406KB, of which ~175KB is
 * commentary, news, videos, odds and boxscore this app has never touched; across
 * a 104-match tournament that is tens of megabytes of storage bought for
 * nothing. Keeping the two real keys halves the archive.
 *
 * The result is still fed to the SAME parser: `summarySchema` ignores unknown
 * keys, so a stored slice and a live payload parse identically. Note the
 * trade-off — a future feature wanting commentary or boxscore would need a
 * re-fetch, and only while ESPN still serves these ids. Widen this function if
 * that ever looks likely; the scoreboard event is archived whole precisely
 * because it is small enough not to need the judgement call.
 */
export function pickSummary(raw) {
  if (!raw || typeof raw !== "object") return null;
  const slice = {};
  if (raw.rosters !== undefined) slice.rosters = raw.rosters;
  if (raw.keyEvents !== undefined) slice.keyEvents = raw.keyEvents;
  // Nothing worth keying a row on — don't store an empty husk that would later
  // read as "we archived this match's lineup" when we didn't.
  return Object.keys(slice).length === 0 ? null : slice;
}
