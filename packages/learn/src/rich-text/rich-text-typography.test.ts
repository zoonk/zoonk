import { formatMoney } from "@zoonk/utils/math-answer";
import { describe, expect, it } from "vitest";
import { typesetMoney, typesetNumbers, typesetProse } from "./rich-text-typography";

const NBSP = "\u00A0";

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

    expect(typesetNumbers({ locale: "de", text: "kostet € 20" })).toBe(`kostet €${NBSP}20`);
  });

  it("writes money the way the readouts and answers beside it do", () => {
    expect(
      typesetNumbers({
        locale: "en",
        text: "Slide the discount on the R$ 80 T-shirt. The line drops R$ 8 for every 10%.",
      }),
    ).toBe("Slide the discount on the R$80 T-shirt. The line drops R$8 for every 10%.");

    expect(typesetNumbers({ locale: "en", text: "US$ 5 or £ 4" })).toBe("US$5 or £4");

    expect(typesetNumbers({ locale: "en", text: "R$ 60" })).toBe(
      formatMoney({ currency: "BRL", locale: "en", value: 60 }),
    );

    expect(typesetNumbers({ locale: "pt", text: "R$ 60" })).toBe(
      formatMoney({ currency: "BRL", locale: "pt", value: 60 }),
    );
  });

  it("leaves a postal code alone after its label or a state's code", () => {
    const text =
      "Write to San Francisco, CA 94103, ZIP code 94103, PLZ 10115 or code postal 75001.";

    expect(typesetNumbers({ locale: "en", text })).toBe(text);

    expect(typesetNumbers({ locale: "en", text: "CA has 39000 schools." })).toBe(
      "CA has 39,000 schools.",
    );

    expect(typesetNumbers({ locale: "en", text: "The UK 12000 and NO 50000 counts." })).toBe(
      "The UK 12,000 and NO 50,000 counts.",
    );
  });

  it("leaves decimals, codes, years and numbers before longer words alone", () => {
    const text = "1,5 mais 12345,67 no CEP 01310-100 em 2026 com 5 pessoas e ID 123456789a";
    expect(typesetNumbers({ locale: "pt", text })).toBe(text);
  });
});

describe(typesetProse, () => {
  it("keeps a money sign with an amount the next segment starts with, and leaves math alone", () => {
    const segments = [
      { kind: "text", text: "It costs R$ " },
      { kind: "bold", text: "80" },
      { kind: "text", text: ", or " },
      { kind: "math", text: "R$ 2" },
    ] as const;

    expect(
      typesetProse({ locale: "en", segments, typeset: (text) => text }).map(({ text }) => text),
    ).toStrictEqual(["It costs R$", "80", ", or ", "R$ 2"]);
  });

  it("sets each prose segment with the given rule", () => {
    const segments = [{ kind: "italic", text: `custa R$${NBSP}80` }];

    expect(
      typesetProse({
        locale: "en",
        segments,
        typeset: (text) => typesetMoney({ locale: "en", text }),
      }),
    ).toStrictEqual([{ kind: "italic", text: "custa R$80" }]);
  });
});

describe(typesetMoney, () => {
  it("writes a question's money as its answer does, the no-break space it keeps included", () => {
    expect(typesetMoney({ locale: "en", text: `15% of R$${NBSP}80 is R$ 12.` })).toBe(
      "15% of R$80 is R$12.",
    );

    expect(typesetMoney({ locale: "pt", text: `custa R$${NBSP}80` })).toBe(
      `custa ${formatMoney({ currency: "BRL", locale: "pt", value: 80 })}`,
    );
  });

  it("leaves a question's other digits as written", () => {
    const text = "ZIP 94103, ID 120045 and 12000 people";
    expect(typesetMoney({ locale: "en", text })).toBe(text);
  });
});
