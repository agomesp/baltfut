import { describe, it, expect } from "vitest";
import { rankSubs, worstPalpiteiro, headToHead, bracketPointsByUser } from "@/lib/ranking";
import type { KnockoutColumn, Match, Side } from "@/lib/espn";
import type { VoteEntry } from "@/lib/votes";

/** A finished knockout match with distinct team codes (for bracket scoring). */
function koMatch(id: string, home: string, away: string, hs: number, as: number): Match {
  return {
    id, league: "fifa.world", name: id, shortName: id, startsAt: "2026-07-05T16:00:00Z", state: "post",
    isLive: false, statusDetail: "FT", displayClock: null, venue: null,
    home: { id: home, name: home, abbreviation: home, logo: null },
    away: { id: away, name: away, abbreviation: away, logo: null },
    homeScore: hs, awayScore: as, homeShootout: null, awayShootout: null, goals: [], cards: [],
  };
}

function match(
  id: string,
  state: Match["state"],
  hs: number | null,
  as: number | null,
  startsAt = "2026-06-20T16:00:00Z",
  shootout?: { h: number; a: number },
): Match {
  return {
    id, league: "fifa.world", name: id, shortName: id, startsAt, state,
    isLive: state === "in", statusDetail: "", displayClock: null, venue: null,
    home: { id: "h", name: "H", abbreviation: "H", logo: null },
    away: { id: "a", name: "A", abbreviation: "A", logo: null },
    homeScore: hs, awayScore: as,
    homeShootout: shootout?.h ?? null, awayShootout: shootout?.a ?? null,
    goals: [], cards: [],
  };
}
function entry(username: string, matchId: string, predHome: number, predAway: number, createdAt = "2026-06-20T15:00:00Z", penWinner?: Side): VoteEntry {
  return { matchId, league: "fifa.world", username, predHome, predAway, penWinner, createdAt };
}

const matchesById: Record<string, Match> = {
  m1: match("m1", "post", 2, 1),
  m2: match("m2", "post", 0, 0),
  mLive: match("mLive", "in", 1, 0),
};

describe("rankSubs", () => {
  it("tallies wins (exact) and losses against finished matches, sorted by wins", () => {
    const ranked = rankSubs(
      [
        entry("ana", "m1", 2, 1), // win
        entry("ana", "m2", 0, 0), // win
        entry("bob", "m1", 1, 1), // loss
        entry("bob", "m2", 0, 0), // win
      ],
      matchesById,
    );
    expect(ranked).toEqual([
      { username: "ana", wins: 2, losses: 0, penWins: 0, penLosses: 0 },
      { username: "bob", wins: 1, losses: 1, penWins: 0, penLosses: 0 },
    ]);
  });

  it("breaks a tie on exact scorelines called, not alphabetically", () => {
    const ms: Record<string, Match> = {
      a: match("a", "post", 1, 0),
      b: match("b", "post", 2, 0),
    };
    // Both land on 2.0, by different routes: zoe called two exact scores, abe
    // called one and topped up with a bracket point. Alphabetical order would
    // have put abe first; calling more finals scores is the better showing.
    const ranked = rankSubs(
      [entry("zoe", "a", 1, 0), entry("zoe", "b", 2, 0), entry("abe", "a", 1, 0)],
      ms,
      { abe: 1 },
    );
    expect(ranked.map((r) => r.username)).toEqual(["zoe", "abe"]);
    expect(ranked.map((r) => r.wins)).toEqual([2, 2]);
  });

  it("a bracket-only sub loses a tie to one who actually called a score", () => {
    // abe's point is purely bracket, so he has no exact scorelines to show.
    const ranked = rankSubs([entry("zoe", "m1", 2, 1)], matchesById, { abe: 1 });
    expect(ranked.map((r) => r.username)).toEqual(["zoe", "abe"]);
  });

  it("still lets a wrong palpite cost nothing — volume never breaks a tie against you", () => {
    const ms: Record<string, Match> = {
      a: match("a", "post", 1, 0),
      b: match("b", "post", 2, 0),
    };
    // Same single exact hit each; zoe also missed once. The miss must not demote
    // her below abe, so the tie falls through to name.
    const ranked = rankSubs(
      [entry("abe", "a", 1, 0), entry("zoe", "a", 1, 0), entry("zoe", "b", 9, 9)],
      ms,
    );
    expect(ranked.map((r) => r.username)).toEqual(["abe", "zoe"]);
  });

  it("orders by correct palpites only — wrong palpites don't change the order", () => {
    const ms: Record<string, Match> = {
      a: match("a", "post", 1, 0),
      b: match("b", "post", 2, 0),
      c: match("c", "post", 3, 0),
    };
    // Both have 1 win. "ana" also has 2 losses, "zeca" has none. Order must be
    // alphabetical (ana, zeca) — NOT fewest-losses-first (which would put zeca on top).
    const ranked = rankSubs(
      [
        entry("ana", "a", 1, 0), // win
        entry("ana", "b", 9, 9), // loss
        entry("ana", "c", 9, 9), // loss
        entry("zeca", "a", 1, 0), // win
      ],
      ms,
    );
    expect(ranked).toEqual([
      { username: "ana", wins: 1, losses: 2, penWins: 0, penLosses: 0 },
      { username: "zeca", wins: 1, losses: 0, penWins: 0, penLosses: 0 },
    ]);
  });

  it("ignores palpites on unfinished matches", () => {
    expect(rankSubs([entry("ana", "mLive", 1, 0)], matchesById)).toEqual([]);
  });

  describe("penalty bonus (shootout matches)", () => {
    // Home wins the shootout 4–3 on a 1–1 regulation draw.
    const ms: Record<string, Match> = { p: match("p", "post", 1, 1, "2026-06-25T16:00:00Z", { h: 4, a: 3 }) };

    it("adds 0.5 for a correct pen winner and tracks the pen W/L breakdown", () => {
      const ranked = rankSubs(
        [
          entry("ace", "p", 1, 1, "t", "home"), // exact score + correct pen → 1 + 0.5
          entry("mid", "p", 0, 2, "t", "home"), // wrong score, correct pen → 0.5 only
          entry("low", "p", 0, 0, "t", "away"), // wrong score, wrong pen → 0 + pen loss
          entry("non", "p", 0, 0, "t"),         // wrong score, no pen call → 0
        ],
        ms,
      );
      expect(ranked).toEqual([
        { username: "ace", wins: 1.5, losses: 0, penWins: 1, penLosses: 0 },
        { username: "mid", wins: 0.5, losses: 1, penWins: 1, penLosses: 0 },
        { username: "low", wins: 0, losses: 1, penWins: 0, penLosses: 1 },
        { username: "non", wins: 0, losses: 1, penWins: 0, penLosses: 0 },
      ]);
    });

    it("ignores a pen winner when the match was NOT decided on pens", () => {
      const decisive: Record<string, Match> = { d: match("d", "post", 2, 1) };
      expect(rankSubs([entry("ana", "d", 2, 1, "t", "away")], decisive)).toEqual([
        { username: "ana", wins: 1, losses: 0, penWins: 0, penLosses: 0 },
      ]);
    });
  });

  describe("worstPalpiteiro", () => {
    it("picks the lowest hit-rate among graded subs", () => {
      const worst = worstPalpiteiro([
        { username: "ace", wins: 3, losses: 0, penWins: 0, penLosses: 0 }, // 100%
        { username: "mid", wins: 1, losses: 1, penWins: 0, penLosses: 0 }, // 50%
        { username: "flop", wins: 0, losses: 2, penWins: 0, penLosses: 0 }, // 0%
      ]);
      expect(worst).toEqual({ username: "flop", wins: 0, losses: 2, pct: 0 });
    });

    it("skips subs with no graded palpites and returns null when nobody qualifies", () => {
      expect(worstPalpiteiro([{ username: "new", wins: 0, losses: 0, penWins: 0, penLosses: 0 }])).toBeNull();
    });
  });

  describe("headToHead (IA vs Você)", () => {
    it("compares exact-score hits over shared FINISHED matches, newest as `last`", () => {
      const ms: Record<string, Match> = {
        a: match("a", "post", 2, 1),
        b: match("b", "post", 0, 0, "2026-06-21T16:00:00Z"),
        c: match("c", "post", 3, 1, "2026-06-22T16:00:00Z"),
        d: match("d", "pre", null, null), // not finished → ignored
      };
      const entries = [
        entry("ChatGPT", "a", 2, 1), entry("ChatGPT", "b", 1, 0), entry("ChatGPT", "c", 3, 1), entry("ChatGPT", "d", 1, 1),
        entry("agomesp", "a", 2, 1), entry("agomesp", "c", 2, 2), entry("agomesp", "d", 0, 0), // no palpite on b
      ];
      const h = headToHead(entries, ms, "ChatGPT", "agomesp");
      expect(h.shared).toBe(2);   // a + c (b only ChatGPT; d unfinished)
      expect(h.aHits).toBe(2);    // ChatGPT a✓ c✓
      expect(h.bHits).toBe(1);    // agomesp a✓ c✗
      expect(h.lead).toBe("a");
      expect(h.last).toEqual({ home: 3, away: 1, aHit: true, bHit: false }); // c is newest
    });

    it("is case-insensitive; an empty opponent name yields an empty duel", () => {
      const ms: Record<string, Match> = { a: match("a", "post", 1, 0) };
      const entries = [entry("CHATGPT", "a", 1, 0), entry("Ana", "a", 1, 0)];
      expect(headToHead(entries, ms, "chatgpt", "ana")).toMatchObject({ shared: 1, aHits: 1, bHits: 1, lead: "tie" });
      expect(headToHead(entries, ms, "ChatGPT", "")).toMatchObject({ shared: 0, aHits: 0, bHits: 0, lead: "tie", last: null });
    });
  });

  it("counts every palpite on a finished match, regardless of when placed", () => {
    // Placed mid-match (the form lock prevents this going forward, but historical
    // live palpites should still count toward wins/losses).
    const late = entry("Markler", "m1", 2, 1, "2026-06-20T16:30:00Z");
    expect(rankSubs([late], matchesById)).toEqual([
      { username: "Markler", wins: 1, losses: 0, penWins: 0, penLosses: 0 },
    ]);
  });
});

describe("bracketPointsByUser + rankSubs bracket folding", () => {
  // A round-of-32 with two finished ties: tie 0 → H wins, tie 1 → A wins.
  const koColumns: KnockoutColumn[] = [
    { slug: "round-of-32", label: "", matches: [koMatch("k0", "H0", "A0", 2, 1), koMatch("k1", "H1", "A1", 0, 1)] },
  ];

  it("awards 0.2 per correct knockout winner and nothing for wrong/pending", () => {
    const pts = bracketPointsByUser(
      [{ username: "ana", picks: { "0-0": "H0", "0-1": "H1" } }], // 0-0 right (H0), 0-1 wrong (real A1)
      koColumns,
    );
    expect(pts.ana).toBeCloseTo(0.2, 5);
    // A pick on an undecided position scores nothing.
    expect(bracketPointsByUser([{ username: "b", picks: { "1-0": "H0" } }], koColumns).b).toBeUndefined();
  });

  it("folds bracket points into a sub's wins and surfaces a bracket-only nickname", () => {
    const ranked = rankSubs(
      [entry("ana", "m1", 2, 1)], // ana: 1 exact-score win
      matchesById,
      { ana: 0.2, solo: 0.4 }, // ana also has bracket pts; solo has ONLY a bracket
    );
    expect(ranked).toEqual([
      { username: "ana", wins: 1.2, losses: 0, penWins: 0, penLosses: 0 },
      { username: "solo", wins: 0.4, losses: 0, penWins: 0, penLosses: 0 },
    ]);
  });
});
