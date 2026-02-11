import { describe, expect, test } from "vitest";
import { computeScore } from "./compute-score";

describe(computeScore, () => {
  test("all correct (5): BP=10, energyDelta=1.0", () => {
    const result = computeScore({
      results: [
        { isCorrect: true },
        { isCorrect: true },
        { isCorrect: true },
        { isCorrect: true },
        { isCorrect: true },
      ],
    });

    expect(result).toEqual({
      brainPower: 10,
      correctCount: 5,
      energyDelta: 1,
      incorrectCount: 0,
    });
  });

  test("all incorrect (5): BP=10, energyDelta=-0.5", () => {
    const result = computeScore({
      results: [
        { isCorrect: false },
        { isCorrect: false },
        { isCorrect: false },
        { isCorrect: false },
        { isCorrect: false },
      ],
    });

    expect(result).toEqual({
      brainPower: 10,
      correctCount: 0,
      energyDelta: -0.5,
      incorrectCount: 5,
    });
  });

  test("mix (3 correct, 2 incorrect): BP=10, energyDelta=0.4", () => {
    const result = computeScore({
      results: [
        { isCorrect: true },
        { isCorrect: true },
        { isCorrect: true },
        { isCorrect: false },
        { isCorrect: false },
      ],
    });

    expect(result).toEqual({
      brainPower: 10,
      correctCount: 3,
      energyDelta: 0.4,
      incorrectCount: 2,
    });
  });

  test("empty results: BP=10, energyDelta=0, counts=0", () => {
    const result = computeScore({ results: [] });

    expect(result).toEqual({
      brainPower: 10,
      correctCount: 0,
      energyDelta: 0,
      incorrectCount: 0,
    });
  });
});
