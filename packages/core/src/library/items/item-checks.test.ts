import { type GeneratedItem } from "@zoonk/ai/tasks/v2/items/schemas";
import { describe, expect, it } from "vitest";
import { discountMath } from "./_test-utils/math-problems";
import { checkItem } from "./item-checks";

type MultipleChoice = Extract<GeneratedItem, { format: "multipleChoice" }>;

const multipleChoice: MultipleChoice = {
  context: "Four friends split a R$ 80 bill, and one pays R$ 20 more than the others.",
  difficulty: "medium",
  format: "multipleChoice",
  image: null,
  options: [
    {
      isCorrect: true,
      misconception: null,
      reason: "80 - 20 = 60, split by 4 = 15.",
      text: "R$ 15",
    },
    {
      isCorrect: false,
      misconception: "Splits the total before removing the extra",
      reason: "You split 80 first and forgot the extra R$ 20.",
      text: "R$ 20",
    },
    {
      isCorrect: false,
      misconception: "Divides by the wrong group",
      reason: "You divided by 3 people instead of 4.",
      text: "R$ 20,00 each",
    },
  ],
  question: "How much does each of the other friends pay?",
  visual: null,
};

describe(checkItem, () => {
  it("passes a well-formed multiple-choice item", () => {
    expect(checkItem({ item: multipleChoice, language: "en" })).toStrictEqual([]);
  });

  it("shows the table, chart, timeline or picture a question points at", () => {
    const pointing = {
      ...multipleChoice,
      context: "Lídia anotou os ofícios no quadro a seguir. No gráfico, junho tem menos.",
    };

    expect(checkItem({ item: pointing, language: "pt" })).toStrictEqual([
      expect.stringContaining("point at a chart"),
      expect.stringContaining("point at a table"),
    ]);

    const shown: MultipleChoice = {
      ...multipleChoice,
      context:
        "Na tabela abaixo:\n\n| Mês | Ofícios |\n|---|---:|\n| Maio | 40 |\n| Junho | 30 |\n\nNo gráfico, junho tem menos.",
      visual: {
        axisStart: null,
        categories: ["Maio", "Junho"],
        categoryLabel: "Mês",
        chart: "bar",
        kind: "chart",
        series: [{ name: "Ofícios", values: [40, 30] }],
        source: null,
        title: "Ofícios por mês",
        unit: null,
        valueLabel: "Ofícios",
      },
    };

    expect(checkItem({ item: shown, language: "pt" })).toStrictEqual([]);

    const picture = { ...multipleChoice, context: "No diagrama, a seta sai do cloroplasto." };

    expect(checkItem({ item: picture, language: "pt" })).toStrictEqual([
      expect.stringContaining("give it an `image`"),
    ]);

    const drawn = {
      ...picture,
      image: {
        alt: "Uma célula vegetal com uma seta saindo do cloroplasto.",
        prompt: "Célula vegetal com o cloroplasto rotulado e uma seta saindo dele.",
      },
    };

    expect(checkItem({ item: drawn, language: "pt" })).toStrictEqual([]);
  });

  it("never points a math problem at a picture, since its numbers change every time", () => {
    const item: GeneratedItem = {
      context: "Na figura, a camisa custa {price} e está com {discount}% de desconto.",
      difficulty: "easy",
      format: "numeric",
      math: discountMath,
      question: "Quanto você paga?",
    };

    expect(checkItem({ item, language: "pt" })).toStrictEqual([
      expect.stringContaining("can't show one"),
    ]);
  });

  it("requires exactly one correct option", () => {
    const item = {
      ...multipleChoice,
      options: multipleChoice.options.map((option) => ({ ...option, isCorrect: true })),
    };

    expect(checkItem({ item, language: "en" })).toContain("Has 3 correct options instead of 1.");
  });

  it("requires distinct options, a reason each and a misconception per wrong option", () => {
    const [correct, first, second] = multipleChoice.options;

    const item = {
      ...multipleChoice,
      options: [
        correct!,
        { ...first!, misconception: null },
        { ...second!, reason: " ", text: " r$ 15 " },
      ],
    };

    expect(checkItem({ item, language: "en" })).toStrictEqual([
      "Two options are the same.",
      "An option has no reason.",
      "A wrong option has no misconception.",
    ]);
  });

  it("reads options without their printed letters, as they're stored", () => {
    const [correct, first, second] = multipleChoice.options;

    const labeled = {
      ...multipleChoice,
      options: [
        { ...correct!, text: "B) R$ 15" },
        { ...first!, text: "A) R$ 20" },
        { ...second!, text: "C) R$ 20,00 each" },
      ],
    };

    const sameOnceUnlabeled = {
      ...labeled,
      options: [labeled.options[0]!, labeled.options[1]!, { ...second!, text: "C) R$ 15" }],
    };

    expect(checkItem({ item: labeled, language: "en" })).toStrictEqual([]);

    expect(checkItem({ item: sameOnceUnlabeled, language: "en" })).toContain(
      "Two options are the same.",
    );
  });

  it("rejects options that print the worked-out values deciding the answer", () => {
    // ENEM placement, Sep 2026: the unit prices were printed next to each pack.
    const leaking: MultipleChoice = {
      context:
        "No mercado, um pacote com 6 maçãs custa R$ 12,00, e outro com 4 maçãs custa R$ 10,00.",
      difficulty: "easy",
      format: "multipleChoice",
      image: null,
      options: [
        {
          isCorrect: true,
          misconception: null,
          reason: "12 ÷ 6 = 2.",
          text: "O de 6 maçãs, a R$ 2,00 por maçã.",
        },
        {
          isCorrect: false,
          misconception: "Escolhe o maior preço unitário",
          reason: "R$ 2,50 é mais.",
          text: "O de 4 maçãs, a R$ 2,50 por maçã.",
        },
        {
          isCorrect: false,
          misconception: "Compara totais",
          reason: "Os pacotes têm quantidades diferentes.",
          text: "O de 4 maçãs, pois custa menos no total.",
        },
      ],
      question: "Qual pacote tem o menor preço por maçã?",
      visual: null,
    };

    expect(checkItem({ item: leaking, language: "en" })).toStrictEqual([
      "Options show the worked-out values that decide the answer.",
    ]);

    // The same question with the choices only, or asking for the value itself, is fine.
    const [first, second, third] = leaking.options;

    const choicesOnly = {
      ...leaking,
      options: [
        { ...first!, text: "O de 6 maçãs." },
        { ...second!, text: "O de 4 maçãs." },
        { ...third!, text: "Os dois custam o mesmo por maçã." },
      ],
    };

    const valuesAsked = {
      ...leaking,
      options: [
        { ...first!, text: "R$ 2,00" },
        { ...second!, text: "R$ 2,50" },
        { ...third!, text: "R$ 1,67" },
      ],
      question: "Quanto custa cada maçã no pacote mais barato por maçã?",
    };

    expect(checkItem({ item: choicesOnly, language: "en" })).toStrictEqual([]);
    expect(checkItem({ item: valuesAsked, language: "en" })).toStrictEqual([]);
  });

  it("keeps options that are values themselves or calculations to judge", () => {
    const point: MultipleChoice = {
      ...multipleChoice,
      context: "A matrix doubles x: [[2, 0], [0, 1]]. A point starts at (3, 4).",
      options: [
        { ...multipleChoice.options[0]!, text: "(6, 4)" },
        { ...multipleChoice.options[1]!, text: "(5, 4)" },
        { ...multipleChoice.options[2]!, text: "(3, 8)" },
      ],
      question: "Where does the point move?",
    };

    const calculations: MultipleChoice = {
      ...multipleChoice,
      options: [
        { ...multipleChoice.options[0]!, text: "Each pays (80 - 20) / 4 = 15" },
        { ...multipleChoice.options[1]!, text: "Each pays 80 / 4 = 20" },
        { ...multipleChoice.options[2]!, text: "Each pays 80 / 3 = 26.67" },
      ],
    };

    expect(checkItem({ item: point, language: "en" })).toStrictEqual([]);
    expect(checkItem({ item: calculations, language: "en" })).toStrictEqual([]);
  });

  it("rejects a reason that points at another option by its place", () => {
    const item = {
      ...multipleChoice,
      options: multipleChoice.options.map((option, index) =>
        index === 0
          ? { ...option, reason: "Like the second option, but removing the extra first." }
          : option,
      ),
    };

    expect(checkItem({ item, language: "en" })).toStrictEqual([
      'A reason points at an option by its place ("second option"); options are shuffled, so name it by what it says.',
    ]);
  });

  it("enforces the exam's number of options", () => {
    expect(checkItem({ item: multipleChoice, language: "en", optionCount: 5 })).toStrictEqual([
      "Has 3 options instead of 5.",
    ]);
  });

  it("rejects an item in a different format than requested", () => {
    expect(
      checkItem({ expectedFormat: "trueFalse", item: multipleChoice, language: "en" }),
    ).toStrictEqual(["Is multipleChoice instead of trueFalse."]);
  });

  it("requires a misconception for false statements only", () => {
    const statement = {
      context: null,
      difficulty: "easy" as const,
      format: "trueFalse" as const,
      image: null,
      misconception: null,
      reason: "The law applies to every contract.",
      statement: "The rule applies only to written contracts.",
      visual: null,
    };

    expect(checkItem({ item: { ...statement, isTrue: true }, language: "en" })).toStrictEqual([]);

    expect(checkItem({ item: { ...statement, isTrue: false }, language: "en" })).toStrictEqual([
      "A false statement has no misconception.",
    ]);
  });

  it("requires key points and a sample answer for typed and spoken items", () => {
    const item: GeneratedItem = {
      acceptedAnswers: ["car", "Car."],
      context: null,
      difficulty: "easy",
      format: "spoken",
      keyPoints: ["Names the vehicle", "names the vehicle"],
      question: "What do you call a vehicle with four wheels?",
      sampleAnswer: "",
    };

    expect(checkItem({ item, language: "en" })).toStrictEqual([
      "Two key points are the same.",
      "Two accepted answers are the same.",
      "Has no sample answer.",
    ]);
  });

  it("gives every rubric row its points, or none", () => {
    const item: GeneratedItem = {
      context: null,
      difficulty: "medium",
      format: "essay",
      keyPoints: ["Names a cause of the war"],
      question: "Evaluate the extent to which trade caused the war.",
      rubric: [
        { criterion: "Thesis", description: "Makes a defensible claim.", points: 1 },
        { criterion: "Evidence", description: "Supports the claim with evidence.", points: null },
      ],
      sampleOutline: "Claim, two pieces of evidence, reasoning.",
    };

    expect(checkItem({ item, language: "en" })).toStrictEqual([
      "Only some rubric rows have points.",
    ]);

    const pointed = item.rubric.map((row) => ({ ...row, points: 2 }));
    expect(checkItem({ item: { ...item, rubric: pointed }, language: "en" })).toStrictEqual([]);
  });

  it("requires pairs and steps a learner can tell apart", () => {
    expect(
      checkItem({
        item: {
          difficulty: "easy",
          format: "matchPairs",
          pairs: [
            { left: "Mitochondria", right: "Energy" },
            { left: "Ribosome", right: "energy" },
          ],
          question: "Match each part to its job.",
          reason: "Each part has one job.",
        },
        language: "en",
      }),
    ).toStrictEqual(["Two right items are the same."]);

    expect(
      checkItem({
        item: {
          difficulty: "easy",
          format: "order",
          question: "Order the steps.",
          reason: "One after the other.",
          steps: ["Mix", "Bake", "mix"],
        },
        language: "en",
      }),
    ).toStrictEqual(["Two steps are the same."]);
  });

  it("recomputes numeric items from their math", () => {
    const item: GeneratedItem = {
      context: null,
      difficulty: "easy",
      format: "numeric",
      math: {
        answer: 12,
        commonMistakes: [{ expression: "a + b", misconception: "Adds", reason: "Multiply." }],
        solution: "a * b",
        steps: [],
        tolerance: { kind: "absolute", value: 0 },
        unit: null,
        variables: [
          { max: 9, min: 1, name: "a", step: 1, unit: null, value: 3 },
          { max: 9, min: 1, name: "b", step: 1, unit: null, value: 5 },
        ],
      },
      question: "What is {a} times {b}?",
    };

    expect(checkItem({ item, language: "en" })).toStrictEqual([
      "The stated answer 12 doesn't match the computed 15.",
    ]);
  });
});
