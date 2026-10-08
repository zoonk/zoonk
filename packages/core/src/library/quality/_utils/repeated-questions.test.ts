import { type WrittenScreen } from "@zoonk/ai/tasks/v2/lesson-writer/schema";
import { describe, expect, it } from "vitest";
import { findRepeatedQuestions } from "./repeated-questions";

function check(question: string): WrittenScreen {
  return {
    context: null,
    image: null,
    kind: "check",
    options: [
      { isCorrect: true, reason: "Right.", text: "A" },
      { isCorrect: false, reason: "Not quite.", text: "B" },
    ],
    question,
    visual: null,
  };
}

function mathCheck(question: string): WrittenScreen {
  return {
    context: null,
    correctReason: "You add {rise} to {start}.",
    kind: "mathCheck",
    math: {
      answer: 3,
      commonMistakes: [],
      solution: "start + rise",
      steps: [],
      tolerance: { kind: "absolute", value: 0 },
      unit: "°C",
      variables: [
        { max: -1, min: -10, name: "start", step: 1, unit: "°C", value: -4 },
        { max: 15, min: 2, name: "rise", step: 1, unit: "°C", value: 7 },
      ],
    },
    question,
  };
}

function explanation(text: string): WrittenScreen {
  return {
    exampleLineIdea: null,
    image: null,
    kind: "explanation",
    text,
    title: "Idea",
    visual: null,
  };
}

describe(findRepeatedQuestions, () => {
  it("finds a check that asks an earlier check's question with other numbers", () => {
    expect(
      findRepeatedQuestions([
        explanation("A point's first number moves right, the second moves up."),
        check("Which dot is at (3, 1)?"),
        check("Which dot is at (2, −3)?"),
      ]),
    ).toStrictEqual([{ repeats: 1, screen: 2 }]);
  });

  it("reads a calculation's placeholders as numbers", () => {
    expect(
      findRepeatedQuestions([
        mathCheck(
          "At 6 am it was {start} °C. By noon it warmed {rise} degrees. What's the reading?",
        ),
        check("At 6 am it was −8 °C. By noon it warmed 11 degrees. What's the reading?"),
      ]),
    ).toStrictEqual([{ repeats: 0, screen: 1 }]);
  });

  it("accepts checks that ask something new about the same idea, and short questions", () => {
    expect(
      findRepeatedQuestions([
        check("How do you simplify 4³ × 4²?"),
        check("How do you simplify 6⁵ ÷ 6²?"),
        check("Which rule did Ana break when she wrote 2³ × 2² = 2⁶?"),
        check("Which one is right?"),
        check("Which one is right?"),
      ]),
    ).toStrictEqual([]);
  });
});
