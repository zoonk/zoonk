import { describe, expect, it } from "vitest";
import { isNumberAnswer } from "./number-answer";

describe(isNumberAnswer, () => {
  it("takes numbers with a decimal comma or point, a unit or a currency", () => {
    expect(isNumberAnswer(["1,5 A", "1.5A"])).toBe(true);
    expect(isNumberAnswer(["R$ 18", "18 reais"])).toBe(true);
    expect(isNumberAnswer(["350.000 kcal"])).toBe(true);
    expect(isNumberAnswer(["20%", "-3"])).toBe(true);
  });

  it("keeps words, sentences and a question without accepted answers in a text field", () => {
    expect(isNumberAnswer(["Ohm's law"])).toBe(false);
    expect(isNumberAnswer(["1,5 A", "one and a half amps"])).toBe(false);
    expect(isNumberAnswer(["Divide 9 by 6 to get 1.5 A"])).toBe(false);
    expect(isNumberAnswer([])).toBe(false);
    expect(isNumberAnswer()).toBe(false);
  });
});
