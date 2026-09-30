import { describe, expect, it } from "vitest";
import {
  currencyFor,
  formatMathAnswer,
  formatMoney,
  getUnitPosition,
  withUnit,
} from "./math-answer";

const NBSP = " ";

describe(formatMathAnswer, () => {
  it("writes money in the language's currency format and other units after the number", () => {
    expect(formatMathAnswer({ language: "pt", unit: "R$", value: 1234.5 })).toBe(
      `R$${NBSP}1.234,50`,
    );

    expect(formatMathAnswer({ language: "en", unit: "$", value: 45 })).toBe("$45");
    expect(formatMathAnswer({ language: "de", unit: "€", value: 3.5 })).toBe(`3,50${NBSP}€`);
    expect(formatMathAnswer({ language: "en", unit: "km", value: 3 })).toBe(`3${NBSP}km`);
    expect(formatMathAnswer({ language: "de", unit: "%", value: 12.5 })).toBe("12,5%");
    expect(formatMathAnswer({ language: "en", unit: null, value: 7 })).toBe("7");
  });

  it("rounds to cents but keeps tiny values readable", () => {
    expect(formatMathAnswer({ language: "en", unit: null, value: 40 / 3 })).toBe("13.33");

    expect(formatMathAnswer({ language: "en", unit: "m", value: 0.0001234 })).toBe(
      `0.00012${NBSP}m`,
    );
  });
});

describe(getUnitPosition, () => {
  it("puts money where the language writes its currency, and other units after the number", () => {
    expect(getUnitPosition({ language: "pt", unit: "R$" })).toBe("prefix");
    expect(getUnitPosition({ language: "en", unit: "$" })).toBe("prefix");
    expect(getUnitPosition({ language: "de", unit: "€" })).toBe("suffix");
    expect(getUnitPosition({ language: "en", unit: "kg" })).toBe("suffix");
  });
});

describe(currencyFor, () => {
  it("reads currency symbols and codes, and nothing else", () => {
    expect(currencyFor("$")).toBe("USD");
    expect(currencyFor("R$")).toBe("BRL");
    expect(currencyFor("EUR")).toBe("EUR");
    expect(currencyFor("months")).toBeNull();
    expect(currencyFor("%")).toBeNull();
    expect(currencyFor()).toBeNull();
  });
});

describe(formatMoney, () => {
  it("writes money the way the learner's language does", () => {
    expect(formatMoney({ currency: "USD", locale: "en", value: 103_449.2 })).toBe("$103,449");
    expect(formatMoney({ currency: "BRL", locale: "pt", value: 1500 })).toBe(`R$${NBSP}1.500`);
    expect(formatMoney({ currency: "EUR", locale: "de", value: 3.5 })).toBe(`3,50${NBSP}€`);
  });

  it("shows cents only when a small amount has them", () => {
    expect(formatMoney({ currency: "USD", locale: "en", value: 3.5 })).toBe("$3.50");
    expect(formatMoney({ currency: "USD", locale: "en", value: 200 })).toBe("$200");
  });

  it("keeps exact digits when asked, with a real minus sign", () => {
    expect(
      formatMoney({ currency: "USD", locale: "en", maximumFractionDigits: 2, value: 3869.684 }),
    ).toBe("$3,869.68");

    expect(formatMoney({ currency: "USD", locale: "en", signed: true, value: -500 })).toBe("−$500");

    expect(formatMoney({ currency: "USD", locale: "en", signed: true, value: 500 })).toBe("+$500");
  });
});

describe(withUnit, () => {
  it("attaches percent and degree signs", () => {
    expect(withUnit("7", "%")).toBe("7%");
    expect(withUnit("45", "°")).toBe("45°");
  });

  it("keeps other units on the same line after a space", () => {
    expect(withUnit("130", "m")).toBe(`130${NBSP}m`);
    expect(withUnit("5", "°C")).toBe(`5${NBSP}°C`);
    expect(withUnit("5")).toBe("5");
  });
});
