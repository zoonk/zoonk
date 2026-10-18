import { type WrittenScreen } from "@zoonk/ai/tasks/v2/lesson-writer/schema";
import { describe, expect, it } from "vitest";
import { writtenTemperatureLesson } from "./_test-utils/written-lessons";
import { repairWrittenLesson } from "./lesson-repairs";

function check(options: { isCorrect: boolean; text: string }[]): WrittenScreen {
  return {
    basis: null,
    context: "| Sensor | mm |\n|---|---|\n| **A | 49,8 |",
    image: null,
    kind: "check",
    options: options.map((option) => ({ ...option, picture: null, reason: "Porque **sim." })),
    question: "Qual sensor mede melhor?",
    visual: null,
  };
}

describe(repairWrittenLesson, () => {
  it("leaves a lesson with nothing to repair as it was", () => {
    const lesson = writtenTemperatureLesson();
    expect(repairWrittenLesson({ language: "en", lesson })).toStrictEqual(lesson);
  });

  it("takes out marks learners would see, in every text and the summary, by how each shows", () => {
    const lesson = {
      screens: [check([{ isCorrect: true, text: "Sensor **A" }])],
      summary: ["A medida **exata vem do sensor A."],
    };

    const repaired = repairWrittenLesson({ language: "pt", lesson });

    expect(repaired.summary).toStrictEqual(["A medida exata vem do sensor A."]);

    expect(repaired.screens[0]).toMatchObject({
      context: "| Sensor | mm |\n|---|---|\n| A | 49,8 |",
      options: [{ reason: "Porque sim.", text: "Sensor A" }],
    });
  });

  it("repairs a question's basis quote like the line it copies, so it still matches", () => {
    const explanation = {
      exampleLineIdea: null,
      explore: null,
      image: null,
      kind: "explanation" as const,
      text: "O sensor A erra menos que [o sensor B](https://example.com).",
      title: "Precisão",
      visual: null,
    };

    const question = {
      ...check([{ isCorrect: true, text: "Sensor A" }]),
      basis: { quote: "O sensor A erra menos que [o sensor B](https://example.com).", screen: 1 },
    };

    const repaired = repairWrittenLesson({
      language: "pt",
      lesson: { screens: [explanation, question], summary: ["Ideia."] },
    });

    expect(repaired.screens[0]).toMatchObject({ text: "O sensor A erra menos que o sensor B." });

    expect(repaired.screens[1]).toMatchObject({
      basis: { quote: "O sensor A erra menos que o sensor B.", screen: 1 },
    });
  });

  it("drops an option written twice while two options stay, keeping the right one", () => {
    const twins = check([
      { isCorrect: false, text: "R$ 15" },
      { isCorrect: true, text: "R$ 15,00" },
      { isCorrect: false, text: "R$ 20" },
    ]);

    const alone = check([
      { isCorrect: true, text: "R$ 15" },
      { isCorrect: false, text: "R$ 15,00" },
    ]);

    const repaired = repairWrittenLesson({
      language: "pt",
      lesson: { screens: [twins, alone], summary: ["Ideia."] },
    });

    const texts = repaired.screens.map((screen) =>
      screen.kind === "check" ? screen.options.map((option) => option.text) : [],
    );

    // A question left with one option isn't one: the fix pass rewrites it.
    expect(texts).toStrictEqual([
      ["R$ 15,00", "R$ 20"],
      ["R$ 15", "R$ 15,00"],
    ]);
  });
});
