import { describe, expect, it } from "vitest";
import { type MockResultPart, getResultAsideParts, getResultSteps } from "./mock-result-steps";

const everything: Record<MockResultPart, boolean> = {
  essays: true,
  plan: true,
  score: true,
  speaking: true,
};

function stepsShown({ has, wide }: { has: Record<MockResultPart, boolean>; wide: boolean }) {
  return getResultSteps(has).flatMap((step) => (wide && step.beside ? [] : [step.part]));
}

describe(getResultSteps, () => {
  it("tells a phone the score, the essays, the speaking paper and the plan", () => {
    expect(stepsShown({ has: everything, wide: false })).toStrictEqual([
      "score",
      "essays",
      "speaking",
      "plan",
    ]);
  });

  it("puts the plan beside the steps on a wide screen", () => {
    expect(stepsShown({ has: everything, wide: true })).toStrictEqual([
      "score",
      "essays",
      "speaking",
    ]);
  });

  it("leaves out what has nothing to say", () => {
    const scoreOnly = { ...everything, essays: false, plan: false, speaking: false };

    expect(stepsShown({ has: scoreOnly, wide: false })).toStrictEqual(["score"]);
  });

  it("starts with the paper when a day is all spoken", () => {
    const spoken = { ...everything, essays: false, plan: false, score: false };

    expect(stepsShown({ has: spoken, wide: false })).toStrictEqual(["speaking"]);
    expect(stepsShown({ has: spoken, wide: true })).toStrictEqual(["speaking"]);
  });
});

describe(getResultAsideParts, () => {
  it("holds the plan when it has something to say", () => {
    expect(getResultAsideParts(everything)).toStrictEqual(["plan"]);
    expect(getResultAsideParts({ ...everything, plan: false })).toStrictEqual([]);
  });
});
