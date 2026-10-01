/**
 * LOCAL-ONLY prod mirror (do not commit / never ships).
 *
 * When `NEXT_PUBLIC_DEV_FIXTURE=1` (set in `.env.local`), the app reads all
 * community data — palpites + promos — from a static, read-only snapshot of
 * prod's PUBLIC views (`public/dev/prod-snapshot.json`) instead of hitting
 * Supabase. This is one-way by construction: the snapshot is a flat file pulled
 * from prod's anon read-views, and nothing here can write back. Casting a
 * palpite locally is a no-op (see {@link DEV_FIXTURE} usage in transport.ts), so
 * prod data can never be touched while testing.
 *
 * Refresh the snapshot from prod with `node scripts/dev/snapshot-prod.mjs`.
 */
import type { VoteEntry } from "@/lib/votes";

/** Read prod data from the local snapshot instead of Supabase. */
export const DEV_FIXTURE = process.env.NEXT_PUBLIC_DEV_FIXTURE === "1";

/** The nickname local dev assumes you are, so the "VOCÊ" tag + IA-vs-você duel
 *  light up against your real prod palpites (vs the ChatGPT bot). */
export const DEV_FIXTURE_NAME = "agomesp";

/** A promo row as stored in the snapshot (mirrors the public `promos` view). */
export interface FixturePromo {
  product: string;
  price: string | null;
  link: string;
  image: string | null;
  store: string | null;
  coupon: string | null;
  position: number;
}

export interface ProdSnapshot {
  generatedAt: string;
  source: string;
  voteEntries: VoteEntry[];
  promos: FixturePromo[];
}

function snapshotUrl(): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return `${base}/dev/prod-snapshot.json`;
}

let cache: Promise<ProdSnapshot> | null = null;

/** Fetch + cache the snapshot once for the page's lifetime. */
export function loadFixture(): Promise<ProdSnapshot> {
  if (!cache) {
    cache = fetch(snapshotUrl()).then((r) => {
      if (!r.ok) throw new Error(`dev fixture load failed: ${r.status}`);
      return r.json() as Promise<ProdSnapshot>;
    });
  }
  return cache;
}

// --- pure selectors (mirror the real fetch* ordering so the UI behaves the
//     same as against prod) — kept separate from fetch() so they're unit-testable.

const byNewest = (a: VoteEntry, b: VoteEntry) => b.createdAt.localeCompare(a.createdAt);

/** Predictions for one match, newest-first — mirrors `fetchVoteEntries`. */
export function selectVoteEntries(all: VoteEntry[], matchId: string, limit = 100): VoteEntry[] {
  return all.filter((e) => e.matchId === matchId).sort(byNewest).slice(0, limit);
}

/** All predictions, newest-first with a match_id tiebreak — mirrors
 *  `fetchAllEntries` (its deterministic order matters for the ranking cap). */
export function selectAllEntries(all: VoteEntry[], limit = 2000): VoteEntry[] {
  return [...all]
    .sort((a, b) => byNewest(a, b) || a.matchId.localeCompare(b.matchId))
    .slice(0, limit);
}

/** Prediction counts per match — mirrors the `vote_match_counts` view. */
export function selectVoteCounts(all: VoteEntry[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const e of all) counts[e.matchId] = (counts[e.matchId] ?? 0) + 1;
  return counts;
}

// --- async wrappers used by the page / components ---------------------------

export async function fixtureVoteEntries(matchId: string, limit?: number): Promise<VoteEntry[]> {
  return selectVoteEntries((await loadFixture()).voteEntries, matchId, limit);
}

export async function fixtureAllEntries(limit?: number): Promise<VoteEntry[]> {
  return selectAllEntries((await loadFixture()).voteEntries, limit);
}

export async function fixtureVoteCounts(): Promise<Record<string, number>> {
  return selectVoteCounts((await loadFixture()).voteEntries);
}

export async function fixturePromos(): Promise<FixturePromo[]> {
  return (await loadFixture()).promos;
}
