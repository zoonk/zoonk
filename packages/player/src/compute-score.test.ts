import { describe, expect, test } from "vitest";
import { computeScore, computeStoryScore } from "./compute-score";

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

describe(computeStoryScore, () => {
  test("all strong: BP=100, energy=15, 5 correct", () => {
    const result = computeStoryScore({
      alignments: ["strong", "strong", "strong", "strong", "strong"],
    });

    expect(result).toEqual({
      brainPower: 100,
      correctCount: 5,
      energyDelta: 15,
      incorrectCount: 0,
    });
  });

  test("all weak: BP=100, energy=0, 0 correct", () => {
    const result = computeStoryScore({
      alignments: ["weak", "weak", "weak", "weak", "weak"],
    });

    expect(result).toEqual({
      brainPower: 100,
      correctCount: 0,
      energyDelta: 0,
      incorrectCount: 5,
    });
  });

  test("all partial: BP=100, energy=5, 5 correct", () => {
    const result = computeStoryScore({
      alignments: ["partial", "partial", "partial", "partial", "partial"],
    });

    expect(result).toEqual({
      brainPower: 100,
      correctCount: 5,
      energyDelta: 5,
      incorrectCount: 0,
    });
  });

  test("mixed alignments: energy sums per choice", () => {
    const result = computeStoryScore({
      alignments: ["strong", "weak", "partial", "strong", "weak"],
    });

    expect(result).toEqual({
      brainPower: 100,
      correctCount: 3,
      energyDelta: 7,
      incorrectCount: 2,
    });
  });

  test("empty alignments: BP=100, energy=0", () => {
    const result = computeStoryScore({ alignments: [] });

    expect(result).toEqual({
      brainPower: 100,
      correctCount: 0,
      energyDelta: 0,
      incorrectCount: 0,
    });
  });
});
