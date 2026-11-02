import { describe, expect, it } from "vitest";
import { addPick, currentStepIndex, firstPicks } from "./step-solver-progress";

const steps = [
  {
    choices: [
      { id: "a", isCorrect: true },
      { id: "b", isCorrect: false },
    ],
    id: "discount",
  },
  {
    choices: [
      { id: "a", isCorrect: false },
      { id: "b", isCorrect: true },
    ],
    id: "tax",
  },
];

describe(currentStepIndex, () => {
  it("waits on the first step without its right move", () => {
    expect(currentStepIndex(steps, {})).toBe(0);
    expect(currentStepIndex(steps, { discount: ["b"] })).toBe(0);
    expect(currentStepIndex(steps, { discount: ["b", "a"] })).toBe(1);
    expect(currentStepIndex(steps, { discount: ["a"], tax: ["b"] })).toBe(2);
  });
});

describe(firstPicks, () => {
  it("has no answer until every step is solved", () => {
    expect(firstPicks(steps, { discount: ["a"] })).toBeNull();
  });

  it("keeps each step's first pick, so a recovered wrong move still counts as wrong", () => {
    expect(firstPicks(steps, { discount: ["b", "a"], tax: ["b"] })).toStrictEqual({
      discount: "b",
      tax: "b",
    });
  });
});

describe(addPick, () => {
  it("adds a pick once and keeps the order", () => {
    const picks = addPick(addPick({}, "tax", "a"), "tax", "b");

    expect(picks).toStrictEqual({ tax: ["a", "b"] });
    expect(addPick(picks, "tax", "a")).toBe(picks);
  });
});
