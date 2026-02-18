import { describe, expect, test } from "vitest";
import { computeChallengeScore, computeScore } from "./compute-score";

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

describe(computeChallengeScore, () => {
  test("successful challenge with positive dimensions: BP=100, energy=sum of positives", () => {
    const result = computeChallengeScore({
      dimensions: { Courage: 2, Diplomacy: 1, Speed: 0 },
      isSuccessful: true,
    });

    expect(result).toEqual({
      brainPower: 100,
      correctCount: 0,
      energyDelta: 3,
      incorrectCount: 0,
    });
  });

  test("successful challenge with all zeros: BP=100, energy=1 (minimum)", () => {
    const result = computeChallengeScore({
      dimensions: { Courage: 0, Diplomacy: 0 },
      isSuccessful: true,
    });

    expect(result).toEqual({
      brainPower: 100,
      correctCount: 0,
      energyDelta: 1,
      incorrectCount: 0,
    });
  });

  test("failed challenge: BP=10, energy=0.1", () => {
    const result = computeChallengeScore({
      dimensions: { Courage: -1, Diplomacy: 2 },
      isSuccessful: false,
    });

    expect(result).toEqual({
      brainPower: 10,
      correctCount: 0,
      energyDelta: 0.1,
      incorrectCount: 0,
    });
  });

  test("successful challenge ignores negative dimensions in energy sum", () => {
    const result = computeChallengeScore({
      dimensions: { Courage: 3, Diplomacy: -1, Speed: 2 },
      isSuccessful: true,
    });

    expect(result).toEqual({
      brainPower: 100,
      correctCount: 0,
      energyDelta: 5,
      incorrectCount: 0,
    });
  });
});
