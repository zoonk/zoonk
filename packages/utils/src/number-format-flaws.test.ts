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

  it("reads prices in dollars as text, not math", () => {
    const value = "Hannah pays $6 to start plus $3 for each hour, $45000 a year.";

    expect(findNumberFormatFlaws({ language: "en", value })).toStrictEqual([
      "Writes 45000 without grouping its digits; write 45,000.",
    ]);
  });
});
