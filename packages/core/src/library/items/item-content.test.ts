import { type GeneratedItem } from "@zoonk/ai/tasks/v2/items/schemas";
import { describe, expect, it } from "vitest";
import { generatedMultipleChoice } from "./_test-utils/generated-items";
import { discountMath } from "./_test-utils/math-problems";
import { parseItemContent, toStoredItem } from "./item-content";

function storedOption(text: string, isCorrect = false) {
  return { isCorrect, misconception: isCorrect ? null : "A trap", reason: "Because.", text };
}

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

  it("stores its own wording without em dashes and quoted support text as written", () => {
    const transcript =
      "A SRA. LORENA — Concluo minha comunicação.\nO SR. PRESIDENTE — O tempo terminou.";

    const essay: Extract<GeneratedItem, { format: "essay" }> = {
      context: "Texto I — trecho de reportagem:\n\n_Faltam rampas — e bancos — nas praças._",
      difficulty: "medium",
      format: "essay",
      keyPoints: ["Defende uma tese — com dois argumentos"],
      question: "Redija um texto dissertativo-argumentativo sobre o lazer das pessoas idosas.",
      rubric: [
        {
          criterion: "Competência 1 — domínio da modalidade escrita formal",
          description:
            "Desenvolve o recorte proposto — o lazer das pessoas idosas — sem fugir dele.",
          points: null,
        },
        {
          criterion: "Competência 2 — coesão",
          description: "Liga as partes do texto.",
          points: null,
        },
      ],
      sampleOutline: "Introdução — cerca de 5 linhas: situar o tema.",
    };

    const statement: Extract<GeneratedItem, { format: "trueFalse" }> = {
      context: `Leia este trecho de um registro de sessão:\n\n${transcript}`,
      difficulty: "medium",
      format: "trueFalse",
      image: null,
      isTrue: true,
      misconception: null,
      reason: "O registro marca cada fala pelo nome — e o presidente encerra o tempo.",
      statement: "O trecho registra a fala de quem preside — e a de uma oradora.",
      visual: null,
    };

    expect(toStoredItem(essay).content).toMatchObject({
      // The motivating text quotes a source: it keeps its own punctuation.
      context: essay.context,
      keyPoints: ["Defende uma tese, com dois argumentos"],
      rubric: [
        {
          criterion: "Competência 1, domínio da modalidade escrita formal",
          description: "Desenvolve o recorte proposto, o lazer das pessoas idosas, sem fugir dele.",
        },
        { criterion: "Competência 2, coesão" },
      ],
      sampleOutline: "Introdução, cerca de 5 linhas: situar o tema.",
    });

    expect(toStoredItem(statement).content).toMatchObject({
      context: statement.context,
      reason: "O registro marca cada fala pelo nome, e o presidente encerra o tempo.",
      statement: "O trecho registra a fala de quem preside, e a de uma oradora.",
    });
  });

  it("stores options without the letters the writer printed before them", () => {
    const [right, wrong] = generatedMultipleChoice().options;

    const labeled = generatedMultipleChoice({
      options: [
        { ...wrong!, text: "B) 20" },
        { ...right!, text: "A) 5" },
      ],
    });

    expect(toStoredItem(labeled).content).toMatchObject({
      options: expect.arrayContaining([
        expect.objectContaining({ isCorrect: true, text: "5" }),
        expect.objectContaining({ isCorrect: false, text: "20" }),
      ]),
    });
  });
});

describe(parseItemContent, () => {
  it("rejects incomplete stored content instead of inventing answer rules", () => {
    expect(() =>
      parseItemContent({
        content: {
          context: null,
          options: [storedOption("A", true), storedOption("B")],
          question: "Q?",
        },
        format: "multipleChoice",
      }),
    ).toThrow();

    expect(() =>
      parseItemContent({
        content: { context: null, math: discountMath, question: "{price} {discount}" },
        format: "numeric",
      }),
    ).toThrow();
  });
});
