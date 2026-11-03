import { type WrittenScreen } from "@zoonk/ai/tasks/lesson-writer/schema";
import { describe, expect, it } from "vitest";
import { hubMap, writtenTemperatureLesson } from "./_test-utils/written-lessons";
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
  it("moves a minus written after the money mark in text, tables, activities and the quote that cites it, keeping the amount", () => {
    const sentence = "The balance ends at $ -12,34 after the refund.";

    const explanation: WrittenScreen = {
      exampleLineIdea: null,
      explore: null,
      image: null,
      kind: "explanation",
      text: `${sentence}\n\n| Item | Amount |\n|---|---:|\n| Balance | $ -12,34 |`,
      title: "A negative balance",
      visual: null,
    };

    const activity: WrittenScreen = {
      content: JSON.stringify({ check: { options: [{ text: "$ -12,34" }] } }),
      kind: "activity",
      template: "formulaModel",
    };

    const quoted: WrittenScreen = {
      basis: { quote: sentence, screen: 1 },
      context: null,
      image: null,
      kind: "check",
      options: ["$ -12,34", "$ 12,34"].map((text, index) => ({
        isCorrect: index === 0,
        picture: null,
        reason: "That's the balance.",
        text,
      })),
      question: "What's the balance?",
      visual: null,
    };

    const [text, play, question] = repairWrittenLesson({
      language: "en",
      lesson: { screens: [explanation, activity, quoted], summary: hubMap(["One idea."]) },
    }).screens;

    const fixed = "-$ 12,34";

    expect(text?.kind === "explanation" && text.text).toBe(
      `The balance ends at ${fixed} after the refund.\n\n| Item | Amount |\n|---|---:|\n| Balance | ${fixed} |`,
    );

    expect(play?.kind === "activity" && play.content).toContain(fixed);
    expect(question?.kind === "check" && question.options[0]?.text).toBe(fixed);

    expect(question?.kind === "check" && question.basis?.quote).toBe(
      `The balance ends at ${fixed} after the refund.`,
    );
  });

  it("moves a minus only in an activity's prose, leaving its program and expected output as written", () => {
    const fields = {
      editableLines: [2],
      expectedOutput: "$-2400.00",
      language: "python",
      solution: 'balance = -2400\nprint("$" + format(balance, ".2f"))',
      starterCode: "balance = -2400\nprint(balance)",
    };

    const exercise: WrittenScreen = {
      content: JSON.stringify({
        check: { explanation: "After rent, the balance is $-2400.00.", kind: "interaction" },
        fields,
      }),
      kind: "activity",
      template: "codeRunner",
    };

    const [repaired] = repairWrittenLesson({
      language: "en",
      lesson: { screens: [exercise], summary: hubMap(["Format money with two decimals."]) },
    }).screens;

    const content: unknown = JSON.parse(repaired?.kind === "activity" ? repaired.content : "{}");

    expect(content).toStrictEqual({
      check: { explanation: "After rent, the balance is -$2400.00.", kind: "interaction" },
      fields,
    });
  });

  it("leaves a lesson with nothing to repair as it was", () => {
    const lesson = writtenTemperatureLesson();
    expect(repairWrittenLesson({ language: "en", lesson })).toStrictEqual(lesson);
  });

  it("takes out marks learners would see, in every text and the map, keeping the map's labels and shape", () => {
    const lesson = {
      screens: [check([{ isCorrect: true, text: "Sensor **A" }])],
      summary: {
        ideas: [
          { label: "Sensor A", text: "A medida **exata vem do sensor A." },
          { label: "Sensor B", text: "O sensor B erra mais." },
        ],
        shape: "nested" as const,
      },
    };

    const repaired = repairWrittenLesson({ language: "pt", lesson });

    expect(repaired.summary).toStrictEqual({
      ideas: [
        { label: "Sensor A", text: "A medida exata vem do sensor A." },
        { label: "Sensor B", text: "O sensor B erra mais." },
      ],
      shape: "nested",
    });

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
      lesson: { screens: [explanation, question], summary: hubMap(["Ideia."]) },
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
      lesson: { screens: [twins, alone], summary: hubMap(["Ideia."]) },
    });

    const texts = repaired.screens.map((screen) =>
      screen.kind === "check" ? screen.options.map((option) => option.text) : [],
    );

    expect(texts).toStrictEqual([
      ["R$ 15,00", "R$ 20"],
      ["R$ 15", "R$ 15,00"],
    ]);
  });
});
