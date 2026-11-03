import { describe, expect, it } from "vitest";
import { createMoneyNotationRepair } from "./money-notation";

function repair(language: string, texts: string[]): string[] {
  const repairText = createMoneyNotationRepair({ language, texts });
  return texts.map((text) => repairText(text));
}

const DECIMAL_COMMA = new Set(["de", "fr", "pl", "pt"]);

function valuesOf(language: string, text: string): number[] {
  return [...text.matchAll(/\d[\d.,\u00A0\u202F ]*\d|\d/gu)].map(([amount]) => {
    const [units = "", cents = "0"] = amount.split(DECIMAL_COMMA.has(language) ? "," : ".");
    return Number(`${units.replaceAll(/\D/gu, "")}.${cents}`);
  });
}

describe(createMoneyNotationRepair, () => {
  it.each([
    [
      "pt",
      ["R$ 3.000,00 brutos", "R$ 2400 de base", "R$ 2.200"],
      ["R$ 3.000 brutos", "R$ 2.400 de base", "R$ 2.200"],
    ],
    ["en", ["$2400.00 a month", "$1,500 rent"], ["$2,400 a month", "$1,500 rent"]],
    ["de", ["2400 € brutto", "300,00 € Abzug"], ["2.400 € brutto", "300 € Abzug"]],
    ["fr", ["2400 € brut"], ["2 400 € brut"]],
    ["es", ["$2400 al mes", "$24000 al año"], ["$2,400 al mes", "$24,000 al año"]],
    [
      "pl",
      ["2400 zł miesięcznie", "24000 zł rocznie"],
      ["2400 zł miesięcznie", "24\u00A0000 zł rocznie"],
    ],
  ])(
    "writes %s money in its own notation, keeping each amount's value",
    (language, texts, expected) => {
      const repaired = repair(language, texts);

      expect(repaired).toStrictEqual(expected);

      expect(repaired.map((text) => valuesOf(language, text))).toStrictEqual(
        texts.map((text) => valuesOf(language, text)),
      );
    },
  );

  it("keeps zero cents when another amount has real cents", () => {
    expect(repair("pt", ["R$ 3.000,00 de salário", "um café de R$ 2,50", "R$ 2400"])).toStrictEqual(
      ["R$ 3.000,00 de salário", "um café de R$ 2,50", "R$ 2.400"],
    );
  });

  it("leaves an amount the language can't read for sure as written, and then keeps every zero cent", () => {
    expect(repair("pt", ["US$ 1,500.00 nos EUA", "R$ 2.000,00 aqui", "R$ 2,400"])).toStrictEqual([
      "US$ 1,500.00 nos EUA",
      "R$ 2.000,00 aqui",
      "R$ 2,400",
    ]);
  });

  it("reads both ends of a money range, and an end it can't read keeps every zero cent", () => {
    expect(repair("pt", ["R$ 3.000,00", "de R$ 2400,00–2500,50"])).toStrictEqual([
      "R$ 3.000,00",
      "de R$ 2.400,00–2.500,50",
    ]);

    expect(repair("pt", ["R$ 3.000,00", "de R$ 2400 a 3600"])).toStrictEqual([
      "R$ 3.000",
      "de R$ 2.400 a 3.600",
    ]);

    expect(repair("pt", ["R$ 3.000,00", "de R$ 2400–2,500"])).toStrictEqual([
      "R$ 3.000,00",
      "de R$ 2.400–2,500",
    ]);

    expect(repair("de", ["300,00 €", "2400–2500,50 €"])).toStrictEqual([
      "300,00 €",
      "2.400–2.500,50 €",
    ]);
  });

  it("leaves numbers without a money mark and compact amounts alone", () => {
    const texts = ["Em 2024, 3000 pessoas", "de R$ 2 mil a R$ 4 mil", "3.000 - 300 = 2.700"];
    expect(repair("pt", texts)).toStrictEqual(texts);
  });
});
