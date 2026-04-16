import { describe, expect, test } from "vitest";
import { type ExplanationResult } from "../generate-explanation-content-step";
import { getExplanationStepsForPractice } from "./get-explanation-steps-for-practice";

function makeResult(activityId: string, steps: string[]): ExplanationResult {
  return {
    activityId,
    concept: `concept-${activityId}`,
    steps: steps.map((text) => ({ text, title: `title-${activityId}` })),
  };
}

describe(getExplanationStepsForPractice, () => {
  test("returns all steps when there is only one practice", () => {
    const results = [makeResult("1", ["a", "b"]), makeResult("2", ["c", "d"])];
    const steps = getExplanationStepsForPractice(results, 0, 1);

    expect(steps.map((step) => step.text)).toEqual(["a", "b", "c", "d"]);
  });

  test("returns first half for practice index 0 when there are two practices", () => {
    const results = [
      makeResult("1", ["a"]),
      makeResult("2", ["b"]),
      makeResult("3", ["c"]),
      makeResult("4", ["d"]),
    ];

    const steps = getExplanationStepsForPractice(results, 0, 2);

    expect(steps.map((step) => step.text)).toEqual(["a", "b"]);
  });

  test("returns second half for practice index 1 when there are two practices", () => {
    const results = [
      makeResult("1", ["a"]),
      makeResult("2", ["b"]),
      makeResult("3", ["c"]),
      makeResult("4", ["d"]),
    ];

    const steps = getExplanationStepsForPractice(results, 1, 2);

    expect(steps.map((step) => step.text)).toEqual(["c", "d"]);
  });

  test("splits 5 results into groups of 2 and 3", () => {
    const results = [
      makeResult("1", ["a"]),
      makeResult("2", ["b"]),
      makeResult("3", ["c"]),
      makeResult("4", ["d"]),
      makeResult("5", ["e"]),
    ];

    const first = getExplanationStepsForPractice(results, 0, 2);
    const second = getExplanationStepsForPractice(results, 1, 2);

    expect(first.map((step) => step.text)).toEqual(["a", "b"]);
    expect(second.map((step) => step.text)).toEqual(["c", "d", "e"]);
  });

  test("returns empty array when explanation results are empty", () => {
    const steps = getExplanationStepsForPractice([], 0, 1);
    expect(steps).toEqual([]);
  });

  test("ensures split index is at least 1 for two practices with single result", () => {
    const results = [makeResult("1", ["a", "b"])];

    const first = getExplanationStepsForPractice(results, 0, 2);
    const second = getExplanationStepsForPractice(results, 1, 2);

    expect(first.map((step) => step.text)).toEqual(["a", "b"]);
    expect(second).toEqual([]);
  });
});
