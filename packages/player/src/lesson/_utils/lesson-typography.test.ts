import { describe, expect, it } from "vitest";
import { typesetNumbers } from "./lesson-typography";

const NBSP = " ";

describe(typesetNumbers, () => {
  it("groups long numbers the learner's way", () => {
    expect(typesetNumbers({ locale: "pt", text: "Um quilo de gordura guarda 350000 kcal." })).toBe(
      `Um quilo de gordura guarda 350.000${NBSP}kcal.`,
    );

    expect(typesetNumbers({ locale: "en", text: "About 12000 people, in 2026." })).toBe(
      "About 12,000 people, in 2026.",
    );
  });

  it("keeps a number with its unit or currency on one line", () => {
    expect(typesetNumbers({ locale: "pt", text: "uma marcada 3 Ω e outra 6 Ω" })).toBe(
      `uma marcada 3${NBSP}Ω e outra 6${NBSP}Ω`,
    );

    expect(typesetNumbers({ locale: "pt", text: "custa R$ 80 e pesa 2 kg" })).toBe(
      `custa R$${NBSP}80 e pesa 2${NBSP}kg`,
    );
  });

  it("leaves decimals, codes, years and numbers before longer words alone", () => {
    const text = "1,5 mais 12345,67 no CEP 01310-100 em 2026 com 5 pessoas e ID 123456789a";
    expect(typesetNumbers({ locale: "pt", text })).toBe(text);
  });
});
