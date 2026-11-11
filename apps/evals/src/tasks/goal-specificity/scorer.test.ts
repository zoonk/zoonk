import { describe, expect, it } from "vitest";
import { scoreGoalSpecificity } from "./scorer";
import { TEST_CASES } from "./test-cases";

describe("goal specificity audience context", () => {
  it.each([
    ["en-field-is-context", "Excel pivot tables for nurses", "works as a nurse"],
    ["pt-field-is-context", "Estatística para enfermeiros", "trabalha como enfermeiro"],
  ])("rejects an invented occupation in %s", async (id, generalGoal, occupation) => {
    const testCase = TEST_CASES.find((item) => item.id === id)!;

    const invented = await scoreGoalSpecificity({
      output: JSON.stringify({ generalGoal, personalDetails: [occupation], privateCourse: false }),
      testCase,
    });

    const grounded = await scoreGoalSpecificity({
      output: JSON.stringify({ generalGoal, personalDetails: [], privateCourse: false }),
      testCase,
    });

    expect(invented.steps.every((step) => step.score < 10)).toBe(true);
    expect(grounded.steps.every((step) => step.score === 10)).toBe(true);
  });
});
