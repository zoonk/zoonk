import { describe, expect, test } from "vitest";
import { computeScore, computeTradeoffScore } from "./compute-score";

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

  test("empty results (static activity): BP=10, energyDelta=0.1", () => {
    const result = computeScore({ results: [] });

    expect(result).toEqual({
      brainPower: 10,
      correctCount: 0,
      energyDelta: 0.1,
      incorrectCount: 0,
    });
  });
});

describe(computeTradeoffScore, () => {
  test("returns 100 BP, 5 energy, 0 correct/incorrect", () => {
    const result = computeTradeoffScore();

    expect(result).toEqual({
      brainPower: 100,
      correctCount: 0,
      energyDelta: 5,
      incorrectCount: 0,
    });
  });
});
