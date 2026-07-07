import { describe, it, expect } from "vitest";
import { parsePromoCommand } from "./promo-command";

describe("parsePromoCommand", () => {
  it("recognizes the bare commands", () => {
    expect(parsePromoCommand("!promo")).toBe("promo");
    expect(parsePromoCommand("!palpites")).toBe("palpites");
  });

  it("is case-insensitive", () => {
    expect(parsePromoCommand("!PROMO")).toBe("promo");
    expect(parsePromoCommand("!Palpites")).toBe("palpites");
  });

  it("finds the command inside a longer message", () => {
    expect(parsePromoCommand("mostra aí !promo por favor")).toBe("promo");
    expect(parsePromoCommand("volta pro !palpites vai")).toBe("palpites");
  });

  it("tolerates trailing punctuation", () => {
    expect(parsePromoCommand("!promo!")).toBe("promo");
    expect(parsePromoCommand("!palpites?")).toBe("palpites");
  });

  it("ignores lookalikes — no bang, or glued to a longer word", () => {
    expect(parsePromoCommand("promo")).toBeNull();
    expect(parsePromoCommand("palpites agora")).toBeNull();
    expect(parsePromoCommand("!promoção incrível")).toBeNull();
    expect(parsePromoCommand("quero !palpiteszinho")).toBeNull();
  });

  it("does not match mid-word", () => {
    expect(parsePromoCommand("a!promo")).toBeNull();
  });

  it("returns the first command when both appear", () => {
    expect(parsePromoCommand("!promo !palpites")).toBe("promo");
  });

  it("handles empty / junk", () => {
    expect(parsePromoCommand("")).toBeNull();
    expect(parsePromoCommand("🔥🔥🔥")).toBeNull();
  });
});
