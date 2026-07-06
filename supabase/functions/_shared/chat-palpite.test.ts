import { describe, it, expect } from "vitest";
import { parseChatPalpite } from "@shared/chat-palpite";

// Match under discussion: Brasil (home) vs Noruega (away).
const BRA = { abbr: "BRA", name: "Brasil" };
const NOR = { abbr: "NOR", name: "Noruega" };
const p = (msg: string) => parseChatPalpite(msg, BRA, NOR);

describe("parseChatPalpite — orientation", () => {
  it("bare score → the first number is the mandante (home)", () => {
    expect(p("2x1")).toEqual({ home: 2, away: 1 });
    expect(p("2 x 1")).toEqual({ home: 2, away: 1 });
    expect(p("2 a 1")).toEqual({ home: 2, away: 1 }); // "dois a um"
    expect(p("0x0")).toEqual({ home: 0, away: 0 });
  });

  it("one team named → that team is the WINNER (higher score), position-independent", () => {
    expect(p("2x1 Brasil")).toEqual({ home: 2, away: 1 });
    expect(p("Brasil 2x1")).toEqual({ home: 2, away: 1 });
    expect(p("2x1 Noruega")).toEqual({ home: 1, away: 2 }); // Noruega wins → 1x2
    expect(p("Noruega 2x1")).toEqual({ home: 1, away: 2 });
    expect(p("Noruega 3x0")).toEqual({ home: 0, away: 3 });
    expect(p("2x1 NOR")).toEqual({ home: 1, away: 2 });
    expect(p("2x1 pro Brasil")).toEqual({ home: 2, away: 1 }); // "pro" connector allowed
  });

  it("both teams named → positional by order (left team = left number)", () => {
    expect(p("BRA 2x1 NOR")).toEqual({ home: 2, away: 1 });
    expect(p("BR 2 x 1 NOR")).toEqual({ home: 2, away: 1 });
    expect(p("NOR 2x1 BRA")).toEqual({ home: 1, away: 2 }); // Noruega listed first & higher
    expect(p("Noruega 2 x 0 Brasil")).toEqual({ home: 0, away: 2 });
  });

  it("a draw makes the team name moot", () => {
    expect(p("2x2 Brasil")).toEqual({ home: 2, away: 2 });
  });
});

describe("parseChatPalpite — rejects non-palpites", () => {
  it("rejects prose that merely MENTIONS a scoreline", () => {
    expect(p("no 7x1 ao menos a gente tava na semifinal")).toBeNull(); // the reported case
    expect(p("aquele 7x1 doeu demais")).toBeNull();
    expect(p("acho que vai dar uns 3x0 sei la")).toBeNull();
    expect(p("quero ver 2x1 hoje e amanha tambem")).toBeNull();
  });

  it("rejects a message with no score at all", () => {
    expect(p("boa noite galera")).toBeNull();
    expect(p("vamo Brasil!!!")).toBeNull();
  });

  it("won't grab a score glued to a longer number", () => {
    expect(p("10x1")).toBeNull();
    expect(p("chego as 21x30")).toBeNull();
  });
});

describe("parseChatPalpite — noise tolerance", () => {
  it("ignores Kick emote tokens and emoji around a real palpite", () => {
    expect(p("[emote:39268:kekw] 2x1 🔥")).toEqual({ home: 2, away: 1 });
    expect(p("2x1 Brasil 🇧🇷🇧🇷")).toEqual({ home: 2, away: 1 });
  });
});

describe("parseChatPalpite — multi-word team names", () => {
  const KOR = { abbr: "KOR", name: "Coreia do Sul" };
  const USA = { abbr: "USA", name: "Estados Unidos" };
  it("handles teams whose names are several words", () => {
    // KOR home, USA away
    expect(parseChatPalpite("2x1 Coreia do Sul", KOR, USA)).toEqual({ home: 2, away: 1 }); // winner KOR
    expect(parseChatPalpite("2x1 Estados Unidos", KOR, USA)).toEqual({ home: 1, away: 2 }); // winner USA
    expect(parseChatPalpite("Coreia 3x2 USA", KOR, USA)).toEqual({ home: 3, away: 2 });
  });
});
