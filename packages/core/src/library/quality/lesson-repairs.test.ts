import { type WrittenScreen } from "@zoonk/ai/tasks/v2/lesson-writer/schema";
import { describe, expect, it } from "vitest";
import { writtenTemperatureLesson } from "./_test-utils/written-lessons";
import { repairWrittenLesson } from "./lesson-repairs";

function check(options: { isCorrect: boolean; text: string }[]): WrittenScreen {
  return {
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
