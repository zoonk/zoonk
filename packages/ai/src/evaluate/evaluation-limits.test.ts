import { describe, expect, it } from "vitest";
import { fitsTokenLimit } from "./evaluation-limits";

const shortQuestion = { instructions: "Is this about cooking?", type: "boolean" } as const;

const longQuestion = {
  criteria: { learn: "x".repeat(600), question: null },
  instructions: "y".repeat(300),
  type: "choice",
} as const;

describe(fitsTokenLimit, () => {
  it("accepts a state and question that fit under the limit", () => {
    expect(
      fitsTokenLimit({ limit: 100, questions: { cooking: shortQuestion }, state: "a".repeat(150) }),
    ).toBe(true);
  });

  it("rejects a state that pushes the total over the limit", () => {
    expect(
      fitsTokenLimit({ limit: 100, questions: { cooking: shortQuestion }, state: "a".repeat(300) }),
    ).toBe(false);
  });

  it("counts only the longest question, not the sum of all questions", () => {
    const questions = { cooking: shortQuestion, intent: longQuestion };

    expect(fitsTokenLimit({ limit: 340, questions, state: "a".repeat(30) })).toBe(true);
    expect(fitsTokenLimit({ limit: 300, questions, state: "a".repeat(30) })).toBe(false);
  });
});
