import { describe, expect, it } from "vitest";
import { type MockResultPart, getResultAsideParts, getResultSteps } from "./mock-result-steps";

const everything: Record<MockResultPart, boolean> = {
  essays: true,
  next: true,
  plan: true,
  score: true,
  speaking: true,
};

function stepsShown({ has, wide }: { has: Record<MockResultPart, boolean>; wide: boolean }) {
  return getResultSteps(has).flatMap((step) => (wide && step.beside ? [] : [step.part]));
}

describe(getResultSteps, () => {
  it("tells a phone the score, the essays, the speaking paper, the plan and what's next", () => {
    expect(stepsShown({ has: everything, wide: false })).toStrictEqual([
      "score",
      "essays",
      "speaking",
      "plan",
      "next",
    ]);
  });

  it("puts the plan and what's next beside the steps on a wide screen", () => {
    expect(stepsShown({ has: everything, wide: true })).toStrictEqual([
      "score",
      "essays",
      "speaking",
    ]);
  });

  it("leaves out what has nothing to say", () => {
    const scoreOnly = { ...everything, essays: false, next: false, plan: false, speaking: false };

    expect(stepsShown({ has: scoreOnly, wide: false })).toStrictEqual(["score"]);

    expect(stepsShown({ has: { ...scoreOnly, next: true }, wide: false })).toStrictEqual([
      "score",
      "next",
    ]);
  });

  it("starts with the paper when a day is all spoken", () => {
    const spoken = { ...everything, essays: false, plan: false, score: false };

    expect(stepsShown({ has: spoken, wide: false })).toStrictEqual(["speaking", "next"]);
    expect(stepsShown({ has: spoken, wide: true })).toStrictEqual(["speaking"]);
  });
});

describe(getResultAsideParts, () => {
  it("holds the plan and what's next when there are some", () => {
    expect(getResultAsideParts(everything)).toStrictEqual(["plan", "next"]);
    expect(getResultAsideParts({ ...everything, plan: false })).toStrictEqual(["next"]);
    expect(getResultAsideParts({ ...everything, next: false, plan: false })).toStrictEqual([]);
  });
});
