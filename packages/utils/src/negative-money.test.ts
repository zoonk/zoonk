import { describe, expect, it } from "vitest";
import { repairNegativeMoney } from "./negative-money";

const AMOUNT = /\d(?:[\d.,\u00A0\u202F ]*\d)?/u;

function amountOf(text: string): string | undefined {
  return AMOUNT.exec(text)?.[0];
}

describe(repairNegativeMoney, () => {
  it.each([
    ["pt", "R$ -2.000,00", "-R$ 2.000,00"],
    ["en", "$-1,500", "-$1,500"],
    ["en", "$ -12,34", "-$ 12,34"],
    ["de", "€ -12.34", "-€ 12.34"],
    ["pt", "US$ -1,500.25", "-US$ 1,500.25"],
    ["ja", "¥ -1,235", "-¥ 1,235"],
    ["ko", "₩ -1.235", "-₩ 1.235"],
    ["tr", "₺ −1.234,50", "−₺ 1.234,50"],
    ["pl", "zł -1 234,50", "-zł 1 234,50"],
  ])(
    "puts the minus before the mark (%s), keeping %s's digits and separators",
    (_, text, fixed) => {
      const repaired = repairNegativeMoney({ text: `Saldo: ${text}.` });

      expect(repaired).toBe(`Saldo: ${fixed}.`);
      expect(amountOf(repaired)).toBe(amountOf(text));
    },
  );

  it("leaves amounts already signed before their mark, and minus signs that aren't money", () => {
    const text = "Saldo: -R$ 2.000,00; temperatura -3 °C; R$ 500,00.";

    expect(repairNegativeMoney({ text })).toBe(text);
  });
});
