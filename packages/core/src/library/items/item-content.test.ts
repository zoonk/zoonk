import { describe, expect, it } from "vitest";
import { generatedMultipleChoice } from "./_test-utils/generated-items";
import { discountMath } from "./_test-utils/math-problems";
import { parseItemContent, toStoredItem } from "./item-content";

function storedOption(text: string, isCorrect = false) {
  return { isCorrect, misconception: isCorrect ? null : "A trap", reason: "Because.", text };
}

describe(parseItemContent, () => {
  it("reads options stored with printed letters without them, in their stored order", () => {
    const content = {
      context: null,
      options: [
        storedOption("D) A perda da função econômica."),
        storedOption("A) A separação entre moradia e trabalho.", true),
        storedOption("C) A distribuição equilibrada dos empregos."),
        storedOption("E) A concentração das moradias."),
        storedOption("B) A substituição dos deslocamentos."),
      ],
      question: "Qual processo o texto descreve?",
    };

    const parsed = parseItemContent({ content, format: "multipleChoice" });

    expect(parsed.format === "multipleChoice" && parsed.content.options).toStrictEqual([
      storedOption("A perda da função econômica."),
      storedOption("A separação entre moradia e trabalho.", true),
      storedOption("A distribuição equilibrada dos empregos."),
      storedOption("A concentração das moradias."),
      storedOption("A substituição dos deslocamentos."),
    ]);
  });
});

describe(toStoredItem, () => {
  const answers = ["True", "False", "Not given"].map((text, index) =>
    storedOption(text, index === 2),
  );

  it("shuffles options once, unless their order is part of the question", () => {
    const shuffled = toStoredItem(generatedMultipleChoice({ options: answers }));
    const fixed = toStoredItem(generatedMultipleChoice({ fixedOrder: true, options: answers }));

    expect(shuffled.content).toMatchObject({ fixedOrder: false, select: 1 });
    expect(fixed.content).toMatchObject({ fixedOrder: true, options: answers });
  });

  it("stores how many options the learner picks and how a number is entered", () => {
    const picked = toStoredItem(generatedMultipleChoice({ options: answers }), { select: "all" });

    const numeric = toStoredItem(
      {
        context: null,
        difficulty: "medium",
        format: "numeric",
        math: discountMath,
        otherSolutions: [],
        question: "A shirt costs {price} and is {discount}% off. How much do you pay?",
      },
      { entry: { kind: "decimals", places: 2 } },
    );

    expect(picked.content).toMatchObject({ select: "all" });
    expect(numeric.content).toMatchObject({ entry: { kind: "decimals", places: 2 } });
  });
});

describe("stored questions written before picks, fixed orders and entry rules", () => {
  it("read as one pick, shuffled options and any number", () => {
    const choice = parseItemContent({
      content: {
        context: null,
        options: [storedOption("A", true), storedOption("B")],
        question: "Q?",
      },
      format: "multipleChoice",
    });

    const numeric = parseItemContent({
      content: { context: null, math: discountMath, question: "{price} {discount}" },
      format: "numeric",
    });

    expect(choice.content).toMatchObject({ fixedOrder: false, select: 1 });

    expect(numeric.content).toMatchObject({
      entry: { kind: "number", places: null },
      otherSolutions: [],
    });
  });
});
