import { describe, expect, it } from "vitest";
import { computeLessonScore } from "./compute-score";

describe("computeLessonScore (generic)", () => {
  it("all correct (5): BP=10, energyDelta=1.0", () => {
    const result = computeLessonScore({
      results: [
        { isCorrect: true },
        { isCorrect: true },
        { isCorrect: true },
        { isCorrect: true },
        { isCorrect: true },
      ],
    });

    expect(result).toStrictEqual({
      brainPower: 10,
      correctCount: 5,
      energyDelta: 1,
      incorrectCount: 0,
    });
  });

  it("all incorrect (5): BP=10, energyDelta=-0.5", () => {
    const result = computeLessonScore({
      results: [
        { isCorrect: false },
        { isCorrect: false },
        { isCorrect: false },
        { isCorrect: false },
        { isCorrect: false },
      ],
    });

    expect(result).toStrictEqual({
      brainPower: 10,
      correctCount: 0,
      energyDelta: -0.5,
      incorrectCount: 5,
    });
  });

  it("mix (3 correct, 2 incorrect): BP=10, energyDelta=0.4", () => {
    const result = computeLessonScore({
      results: [
        { isCorrect: true },
        { isCorrect: true },
        { isCorrect: true },
        { isCorrect: false },
        { isCorrect: false },
      ],
    });

    expect(result).toStrictEqual({
      brainPower: 10,
      correctCount: 3,
      energyDelta: 0.4,
      incorrectCount: 2,
    });
  });

  it("empty results (static lesson): BP=10, energyDelta=0.1", () => {
    const result = computeLessonScore({ results: [] });

    expect(result).toStrictEqual({
      brainPower: 10,
      correctCount: 0,
      energyDelta: 0.1,
      incorrectCount: 0,
    });
  });
});
