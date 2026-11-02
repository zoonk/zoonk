import { describe, expect, it } from "vitest";
import { toDrillFeedback } from "./pattern-drill-feedback";

const question = {
  answer: "fui ",
  feedback: "Ir in the past: fui.",
  options: ["fue", "fui", "iba"],
  sentence: "Ayer yo ___ al cine.",
};

describe(toDrillFeedback, () => {
  it("marks the right option though the answer has spaces around it, as the grade trims it", () => {
    expect(toDrillFeedback({ answer: "fui", question })).toStrictEqual({
      correctAnswer: { selectedIndex: 1 },
      explanation: "Ir in the past: fui.",
      isCorrect: true,
    });
  });
});
