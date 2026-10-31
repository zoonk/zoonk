import { describe, expect, it } from "vitest";
import { shuffleSteps, stepResults } from "./process-order-model";

const steps = ["absorb", "split", "store", "calvin", "starch"].map((id) => ({ id }));

describe(shuffleSteps, () => {
  it("shuffles the same way for the same seed", () => {
    expect(shuffleSteps(steps, "leaf")).toStrictEqual(shuffleSteps(steps, "leaf"));

    expect(
      shuffleSteps(steps, "leaf")
        .map((step) => step.id)
        .toSorted(),
    ).toStrictEqual(steps.map((step) => step.id).toSorted());
  });

  it("never starts in the right order, whatever the seed", () => {
    const pair = [{ id: "a" }, { id: "b" }];

    for (const seed of Array.from({ length: 50 }, (_, index) => `seed-${index}`)) {
      expect(shuffleSteps(pair, seed).map((step) => step.id)).toStrictEqual(["b", "a"]);

      expect(shuffleSteps(steps, seed).map((step) => step.id)).not.toStrictEqual(
        steps.map((step) => step.id),
      );
    }
  });
});

describe(stepResults, () => {
  it("pairs each step's true place with the learner's", () => {
    expect(stepResults({ expected: ["a", "b", "c"], order: ["a", "c", "b"] })).toStrictEqual([
      { id: "a", learnerPosition: 1, position: 1 },
      { id: "b", learnerPosition: 3, position: 2 },
      { id: "c", learnerPosition: 2, position: 3 },
    ]);
  });

  it("marks a step missing from the learner's order", () => {
    expect(stepResults({ expected: ["a", "b"], order: ["a"] })[1]).toStrictEqual({
      id: "b",
      learnerPosition: null,
      position: 2,
    });
  });
});
