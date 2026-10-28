import { type GeneratedItem } from "@zoonk/ai/tasks/v2/items/schemas";
import { describe, expect, it } from "vitest";
import { generatedMultipleChoice, generatedTypedItem } from "./_test-utils/generated-items";
import { discountMath, discountQuestion } from "./_test-utils/math-problems";
import { checkItem } from "./item-checks";
import { repairItem } from "./item-repairs";

type ItemOf<FORMAT extends GeneratedItem["format"]> = Extract<GeneratedItem, { format: FORMAT }>;

const [RIGHT, WRONG] = generatedMultipleChoice().options;

function option(text: string, isCorrect = false) {
  return { ...(isCorrect ? RIGHT! : WRONG!), text };
}

function braced(expression: string): string {
  return expression.replaceAll(/\b(?<name>price|discount)\b/gu, "{$<name>}");
}

describe(repairItem, () => {
  it("leaves an item with nothing to repair as it was", () => {
    const item = generatedMultipleChoice();
    expect(repairItem({ item, language: "pt" })).toStrictEqual(item);
  });

  it("takes out marks learners would see, by how each text shows", () => {
    const item = generatedMultipleChoice({
      context: "## Fala\n_Presidente: a sessão está aberta.\nO orador tem a palavra._",
      options: [option("**5", true), option("Veja [20](https://example.com)")],
    });

    const repaired = repairItem({ item, language: "pt" });

    expect(repaired).toMatchObject({
      context: "Fala\nPresidente: a sessão está aberta.\nO orador tem a palavra.",
      options: [{ text: "5" }, { text: "Veja 20" }],
    });

    expect(checkItem({ item: repaired, language: "pt" })).toStrictEqual([]);
  });

  it("drops an option written twice when the question keeps the options its exam asks for", () => {
    const options = ["5", "20", "15", "10", "5,0", "25"].map((text, index) =>
      option(text, index === 4),
    );

    const repaired = repairItem({
      item: generatedMultipleChoice({ options }),
      language: "pt",
      optionCount: 5,
    });

    expect(repaired.options.map((item) => [item.text, item.isCorrect])).toStrictEqual([
      ["5,0", true],
      ["20", false],
      ["15", false],
      ["10", false],
      ["25", false],
    ]);

    const short = generatedMultipleChoice({ options: options.slice(0, 5) });

    expect(repairItem({ item: short, language: "pt", optionCount: 5 })).toStrictEqual(short);
  });

  it("drops key points, accepted answers and pairs written twice", () => {
    const typed = repairItem({
      item: generatedTypedItem({
        acceptedAnswers: ["mitochondria", "Mitochondria.", "the mitochondria"],
        keyPoints: ["Names the mitochondria", "names the mitochondria "],
      }),
      language: "en",
    });

    expect([typed.acceptedAnswers, typed.keyPoints]).toStrictEqual([
      ["mitochondria", "the mitochondria"],
      ["Names the mitochondria"],
    ]);

    const pairs: ItemOf<"matchPairs"> = {
      difficulty: "easy",
      format: "matchPairs",
      pairs: [
        { left: "H2O", right: "Água" },
        { left: "NaCl", right: "Sal" },
        { left: "h2o", right: "água" },
      ],
      question: "Ligue cada fórmula ao nome.",
      reason: "Cada fórmula tem um nome.",
    };

    expect(repairItem({ item: pairs, language: "pt" }).pairs).toStrictEqual(
      pairs.pairs.slice(0, 2),
    );
  });

  it("drops another answer that only repeats the solution or an earlier one", () => {
    const numeric: ItemOf<"numeric"> = {
      context: null,
      difficulty: "medium",
      format: "numeric",
      math: discountMath,
      otherSolutions: [
        "price - price * discount / 100",
        "price * (1 - discount / 100)",
        "price / 2",
        "price/2",
      ],
      question: discountQuestion,
    };

    expect(repairItem({ item: numeric, language: "en" }).otherSolutions).toStrictEqual([
      "price / 2",
    ]);
  });

  it("takes the braces off variables an expression names as the text does, so its math checks", () => {
    const numeric: ItemOf<"numeric"> = {
      context: null,
      difficulty: "medium",
      format: "numeric",
      math: {
        ...discountMath,
        commonMistakes: discountMath.commonMistakes.map((mistake) => ({
          ...mistake,
          expression: braced(mistake.expression),
        })),
        solution: braced(discountMath.solution),
        steps: discountMath.steps.map((step) => ({
          ...step,
          expression: step.expression && braced(step.expression),
        })),
      },
      otherSolutions: ["{price} / 2"],
      question: discountQuestion,
    };

    const repaired = repairItem({ item: numeric, language: "en" });

    expect(
      checkItem({ expectedFormat: "numeric", item: numeric, language: "en" }),
    ).not.toStrictEqual([]);

    expect(repaired).toStrictEqual({
      ...numeric,
      math: discountMath,
      otherSolutions: ["price / 2"],
    });

    expect(checkItem({ expectedFormat: "numeric", item: repaired, language: "en" })).toStrictEqual(
      [],
    );
  });
});
