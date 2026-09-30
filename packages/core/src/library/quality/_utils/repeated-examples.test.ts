import { type LessonScreenKind, type LessonSpec } from "@zoonk/ai/tasks/v2/lesson-spec/rules";
import { type WrittenScreen } from "@zoonk/ai/tasks/v2/lesson-writer/schema";
import { describe, expect, it } from "vitest";
import { temperatureSpec } from "../_test-utils/written-lessons";
import { findRepeatedExamples } from "./repeated-examples";

function specOf(kinds: LessonScreenKind[]): LessonSpec {
  const spec = temperatureSpec();

  return {
    ...spec,
    screens: kinds.map((kind) => ({
      activityTemplate: null,
      brief: kind,
      kind,
      skills: kind === "hook" ? [] : [0],
      visual: null,
    })),
  };
}

function explanation(text: string): WrittenScreen {
  return { exampleLineIdea: null, image: null, kind: "explanation", text, title: "Idea" };
}

function check(question: string, options: [string, string] = ["Yes", "No"]): WrittenScreen {
  return {
    context: null,
    image: null,
    kind: "check",
    options: [
      { isCorrect: true, reason: "Right.", text: options[0] },
      { isCorrect: false, reason: "Not quite.", text: options[1] },
    ],
    question,
  };
}

function mathCheck(values: Record<string, number>): WrittenScreen {
  return {
    context: "Uma ação custa {buy} para comprar e {sell} para vender.",
    correctReason: "Você paga {buy} e recebe {sell}.",
    kind: "mathCheck",
    math: {
      answer: 0,
      commonMistakes: [{ expression: "buy", misconception: "Preço cheio", reason: "Subtraia." }],
      solution: "buy - sell",
      steps: [],
      tolerance: { kind: "absolute", value: 0 },
      unit: null,
      variables: Object.entries(values).map(([name, value]) => ({
        max: value * 2,
        min: 1,
        name,
        step: 1,
        unit: null,
        value,
      })),
    },
    question: "Quanto você perde comprando e vendendo na hora?",
  };
}

const earlierLesson = {
  examples: ["A stock traded for $20 a minute ago, then for $21. What might have changed?"],
  order: "before" as const,
  title: "Why stock prices change",
};

describe(findRepeatedExamples, () => {
  it("finds a screen that reuses the numbers of an earlier lesson's case", () => {
    expect(
      findRepeatedExamples({
        chapterLessons: [earlierLesson],
        language: "en",
        screens: [
          explanation("A share is a small piece of a company."),
          check("Ten shares sell at $20 and the next ones at $21. What do 15 shares cost?"),
        ],
        spec: specOf(["explanation", "check"]),
      }),
    ).toStrictEqual([
      { numbers: [20, 21], repeats: { lesson: "Why stock prices change" }, screen: 1 },
    ]);
  });

  it("leaves lessons taught next to pick their own numbers", () => {
    expect(
      findRepeatedExamples({
        chapterLessons: [{ ...earlierLesson, order: "after" }],
        language: "en",
        screens: [check("A share trades at $20, then at $21. Why?")],
        spec: specOf(["check"]),
      }),
    ).toStrictEqual([]);
  });

  it("doesn't count one shared number, counts up to ten, 100 or years as the same case", () => {
    expect(
      findRepeatedExamples({
        chapterLessons: [
          {
            ideas: [
              "In 1760 about 3 in 100 workers had machines, at $20 a week for 10 hours a day.",
            ],
            order: "before",
            title: "Factories",
          },
        ],
        language: "en",
        screens: [check("By 1760, 3 of 100 workers earned $20 for 10 hours and 5 earned $35.")],
        spec: specOf(["check"]),
      }),
    ).toStrictEqual([]);
  });

  it("doesn't count two numbers a long table happens to share", () => {
    expect(
      findRepeatedExamples({
        chapterLessons: [earlierLesson],
        language: "en",
        screens: [
          check("Prices over a week: $20, $21, $24, $26, $27 and $29. Which day rose most?"),
        ],
        spec: specOf(["check"]),
      }),
    ).toStrictEqual([]);
  });

  it("reads numbers the way the lesson's language writes them", () => {
    expect(
      findRepeatedExamples({
        chapterLessons: [
          {
            examples: ["Uma ação custa R$ 20,10 para comprar e R$ 20,00 para vender."],
            order: "before",
            title: "Spread",
          },
        ],
        language: "pt",
        screens: [mathCheck({ buy: 20.1, sell: 20 })],
        spec: specOf(["check"]),
      }),
    ).toStrictEqual([{ numbers: [20.1, 20], repeats: { lesson: "Spread" }, screen: 0 }]);
  });

  it("finds an application that reuses an earlier screen's case", () => {
    const orders = "10 shares are offered at $20 and 20 more at $21. You buy 25.";

    expect(
      findRepeatedExamples({
        language: "en",
        screens: [
          explanation(orders),
          check("Which order reaches the $21 offer: 5 shares or 25?"),
          check(`In your app, ${orders} How many shares cost $21?`, ["15", "25"]),
        ],
        spec: specOf(["explanation", "check", "application"]),
      }),
    ).toStrictEqual([{ numbers: [20, 21, 25], repeats: { screen: 0 }, screen: 2 }]);
  });

  it("lets every screen repeat numbers the lesson's sources state", () => {
    const extension = "Send Form 4868 by April 15 and you can file by October 15.";

    const input = {
      language: "en",
      screens: [
        explanation(extension),
        check(`It's April 2 in Denver. ${extension} What do you do first?`),
      ],
      spec: specOf(["explanation", "application"]),
    };

    expect(findRepeatedExamples(input)).toStrictEqual([
      { numbers: [4868, 15], repeats: { screen: 0 }, screen: 1 },
    ]);

    expect(
      findRepeatedExamples({
        ...input,
        documents: "File Form 4868 by April 15, 2026 to get until October 15, 2026 to file.",
      }),
    ).toStrictEqual([]);
  });

  it("accepts an application with a new situation", () => {
    expect(
      findRepeatedExamples({
        language: "en",
        screens: [
          explanation("10 shares are offered at $20 and 20 more at $21. You buy 25."),
          check("In your app, 40 shares sit at $12 and 60 at $13. You buy 70. How many cost $13?"),
        ],
        spec: specOf(["explanation", "application"]),
      }),
    ).toStrictEqual([]);
  });
});
