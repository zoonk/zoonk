import { describe, expect, it } from "vitest";
import { superscriptPowers } from "./plain-powers";

describe(superscriptPowers, () => {
  it("raises a caret's power, after a letter, a number or a bracket", () => {
    expect(superscriptPowers("M = C·(1 + i)^n")).toBe("M = C·(1 + i)ⁿ");
    expect(superscriptPowers("A = πr^2 e 10^-3 m")).toBe("A = πr² e 10⁻³ m");
    expect(superscriptPowers("V = a^3, não a×3")).toBe("V = a³, não a×3");
  });

  it("raises a grouped power without its brackets", () => {
    expect(superscriptPowers("2^(n+1) e x^{n - 1}")).toBe("2ⁿ⁺¹ e xⁿ⁻¹");
  });

  it("leaves text without a caret, and a power it can't raise, as written", () => {
    expect(superscriptPowers("CO₂ e R$ 800 a 10% dá R$ 880")).toBe("CO₂ e R$ 800 a 10% dá R$ 880");

    expect(superscriptPowers("x^q, a^(b/c) e o símbolo ^ sozinho")).toBe(
      "x^q, a^(b/c) e o símbolo ^ sozinho",
    );
  });
});
