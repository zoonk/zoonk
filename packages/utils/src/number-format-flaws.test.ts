import { describe, expect, it } from "vitest";
import { findNumberFormatFlaws } from "./number-format-flaws";

describe(findNumberFormatFlaws, () => {
  it("finds long numbers written without grouping, with the grouping the language uses", () => {
    const value = { question: "Uma empresa tem 40000000 ações e você tem 12500." };

    expect(findNumberFormatFlaws({ language: "pt", value })).toStrictEqual([
      "Writes 40000000 without grouping its digits; write 40.000.000.",
      "Writes 12500 without grouping its digits; write 12.500.",
    ]);

    expect(findNumberFormatFlaws({ language: "en", value })).toStrictEqual([
      "Writes 40000000 without grouping its digits; write 40,000,000.",
      "Writes 12500 without grouping its digits; write 12,500.",
    ]);

    expect(findNumberFormatFlaws({ language: "es", value })).toStrictEqual([
      "Writes 40000000 without grouping its digits; write 40,000,000.",
      "Writes 12500 without grouping its digits; write 12,500.",
    ]);
  });

  it("passes grouped numbers, years, decimals, codes, dates and money", () => {
    const value = {
      context:
        "Em 2026, 40.000.000 de ações valiam R$ 1.250,75; o CEP 01310-100 e o ID 123456789a.",
      options: [{ reason: "São 3,14159 e 0,000125, em 27/09/2026 às 14h30." }],
      question: "Quanto vale 1,5 milhão, ou 12.500 de 40 milhões?",
    };

    expect(findNumberFormatFlaws({ language: "pt", value })).toStrictEqual([]);
  });

  it("leaves out code, data fields, answers to match and picture requests", () => {
    const value = {
      acceptedAnswers: ["12500", "12.500"],
      content: '{"initial":10000}',
      image: { alt: "Um gráfico de barras.", prompt: "Bars of 50000 and 80000" },
      math: { solution: "owned / 40000000", steps: [{ expression: "x * 10000", text: "{x}" }] },
      text: "Rode `print(12345678)` e veja:\n```\n100000\n```",
    };

    expect(findNumberFormatFlaws({ language: "pt", value })).toStrictEqual([]);
  });

  it("finds a bare decimal comma in LaTeX math where the language writes one", () => {
    const value = {
      steps: [{ math: String.raw`0,30 \times 0,20 = 0{,}06`, text: "Multiplique." }],
      text: String.raw`A carga é $k = 9,0 \times 10^9$, e $1{,}5 + 2{,}5 = 4$ está certo.`,
    };

    expect(findNumberFormatFlaws({ language: "pt", value })).toStrictEqual([
      String.raw`Writes a decimal comma in LaTeX math as a bare comma, which shows as a list: "0,30 \times 0,20 = 0{,}06". Brace it, as in 0{,}5.`,
      String.raw`Writes a decimal comma in LaTeX math as a bare comma, which shows as a list: "k = 9,0 \times 10^9". Brace it, as in 0{,}5.`,
    ]);
  });

  it("passes points, intervals and money signs, and English commas in math", () => {
    const value = { pt: String.raw`O ponto $(3,4)$ fica em $[0,1]$; custa R$ 80 e R$ 90.` };

    expect(findNumberFormatFlaws({ language: "pt", value })).toStrictEqual([]);

    expect(
      findNumberFormatFlaws({ language: "en", value: String.raw`Add $(5,1,-3)$ and $2,5$.` }),
    ).toStrictEqual([]);
  });

  it("suggests grouping LaTeX can show inside math", () => {
    expect(
      findNumberFormatFlaws({ language: "en", value: String.raw`So $100 \times 100 = 10000$.` }),
    ).toStrictEqual(["Writes 10000 without grouping its digits; write 10{,}000."]);

    expect(findNumberFormatFlaws({ language: "fr", value: { math: "12500 + 1" } })).toStrictEqual([
      String.raw`Writes 12500 without grouping its digits; write 12\,500.`,
    ]);
  });

  it(String.raw`reads math between \( \) and \[ \] as math, as the players typeset it`, () => {
    expect(
      findNumberFormatFlaws({
        language: "pt",
        value: String.raw`A carga é \(k = 9,0 \times 10^9\) e a área \[A = 10000\].`,
      }),
    ).toStrictEqual([
      String.raw`Writes a decimal comma in LaTeX math as a bare comma, which shows as a list: "k = 9,0 \times 10^9". Brace it, as in 0{,}5.`,
      String.raw`Writes 10000 without grouping its digits; write 10.000.`,
    ]);
  });

  it("reads prices in dollars as text, not math", () => {
    const value = "Hannah pays $6 to start plus $3 for each hour, $45000 a year.";

    expect(findNumberFormatFlaws({ language: "en", value })).toStrictEqual([
      "Writes 45000 without grouping its digits; write 45,000.",
    ]);
  });

  it("finds digits grouped with a space where the language groups them another way", () => {
    const value = {
      steps: [{ math: String.raw`50\,000 \times 0.1 = 5 000` }],
      text: "The grass holds 50 000 kcal, so 5 000 reach the rabbits.",
    };

    expect(findNumberFormatFlaws({ language: "en", value })).toStrictEqual([
      String.raw`Groups 50\,000 with a space; write 50{,}000.`,
      "Groups 5 000 with a space; write 5{,}000.",
      "Groups 50 000 with a space; write 50,000.",
      "Groups 5 000 with a space; write 5,000.",
    ]);

    expect(findNumberFormatFlaws({ language: "pt", value: { text: value.text } })).toStrictEqual([
      "Groups 50 000 with a space; write 50.000.",
      "Groups 5 000 with a space; write 5.000.",
    ]);
  });

  it("keeps the sign and the decimals of a number grouped with a space", () => {
    const value = { text: "It fell by −50 000 kcal, then by -5 000.5 more." };

    expect(findNumberFormatFlaws({ language: "en", value })).toStrictEqual([
      "Groups −50 000 with a space; write −50,000.",
      "Groups -5 000.5 with a space; write -5,000.5.",
    ]);

    expect(
      findNumberFormatFlaws({ language: "pt", value: { text: "Caiu 5 000,5 kcal." } }),
    ).toStrictEqual(["Groups 5 000,5 with a space; write 5.000,5."]);
  });

  it("writes the decimal mark the language uses in the rewrite of a number grouped with a space", () => {
    expect(
      findNumberFormatFlaws({ language: "en", value: { text: "It holds 50 000,5 kcal." } }),
    ).toStrictEqual(["Groups 50 000,5 with a space; write 50,000.5."]);

    expect(
      findNumberFormatFlaws({ language: "pt", value: { text: "Cabem 50 000.5 kcal." } }),
    ).toStrictEqual(["Groups 50 000.5 with a space; write 50.000,5."]);
  });

  it("keeps every digit of a long number grouped with a space", () => {
    expect(
      findNumberFormatFlaws({
        language: "en",
        value: {
          text: "It counts 9 007 199 254 740 993 grains, or 50 000.123456789123 kg, of 9007199254740993.",
        },
      }),
    ).toStrictEqual([
      "Writes 9007199254740993 without grouping its digits; write 9,007,199,254,740,993.",
      "Groups 9 007 199 254 740 993 with a space; write 9,007,199,254,740,993.",
      "Groups 50 000.123456789123 with a space; write 50,000.123456789123.",
    ]);
  });

  it("finds a number grouped with a space right after a plus in math", () => {
    expect(
      findNumberFormatFlaws({ language: "en", value: { math: String.raw`x+50\,000` } }),
    ).toStrictEqual([String.raw`Groups 50\,000 with a space; write 50{,}000.`]);
  });

  it("passes space grouping where the language groups with a space, and digits that aren't one number", () => {
    const french = { text: "L'herbe contient 50 000 kcal." };
    const phones = { text: "Call 555 123 4567 or +41 800 123 456, or see items 12 and 345." };

    expect(findNumberFormatFlaws({ language: "fr", value: french })).toStrictEqual([]);
    expect(findNumberFormatFlaws({ language: "en", value: phones })).toStrictEqual([]);
  });
});
