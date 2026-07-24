import { describe, expect, it } from "vitest";
import {
  getScorePerformance,
  getStrongestScorePerformance,
  getWeeklyScorePerformance,
} from "./score-performance";

describe(getScorePerformance, () => {
  it("calculates score and exposes every answer count", () => {
    expect(getScorePerformance({ correctAnswers: 17, incorrectAnswers: 3 })).toStrictEqual({
      correctAnswers: 17,
      incorrectAnswers: 3,
      score: 85,
      totalAnswers: 20,
    });
  });

  it("returns null when no questions were answered", () => {
    expect(getScorePerformance({ correctAnswers: 0, incorrectAnswers: 0 })).toBeNull();
  });
});

describe(getStrongestScorePerformance, () => {
  it("ranks by score before answer volume", () => {
    const highVolume = {
      correctAnswers: 99,
      incorrectAnswers: 1,
      key: "high-volume",
      score: 99,
      totalAnswers: 100,
    };

    const perfect = {
      correctAnswers: 1,
      incorrectAnswers: 0,
      key: "perfect",
      score: 100,
      totalAnswers: 1,
    };

    expect(getStrongestScorePerformance([highVolume, perfect])).toStrictEqual(perfect);
  });

  it("uses answer volume when scores are equal", () => {
    const smaller = {
      correctAnswers: 9,
      incorrectAnswers: 1,
      key: "smaller",
      score: 90,
      totalAnswers: 10,
    };

    const larger = {
      correctAnswers: 18,
      incorrectAnswers: 2,
      key: "larger",
      score: 90,
      totalAnswers: 20,
    };

    expect(getStrongestScorePerformance([smaller, larger])).toStrictEqual(larger);
  });
});

describe(getWeeklyScorePerformance, () => {
  it("combines answer counts inside UTC Monday-based weeks", () => {
    const result = getWeeklyScorePerformance([
      { correctAnswers: 1, date: new Date("2026-07-13T00:00:00.000Z"), incorrectAnswers: 0 },
      { correctAnswers: 0, date: new Date("2026-07-19T00:00:00.000Z"), incorrectAnswers: 9 },
      { correctAnswers: 8, date: new Date("2026-07-20T00:00:00.000Z"), incorrectAnswers: 2 },
    ]);

    expect(result).toStrictEqual([
      {
        correctAnswers: 1,
        date: new Date("2026-07-13T00:00:00.000Z"),
        incorrectAnswers: 9,
        score: 10,
        totalAnswers: 10,
      },
      {
        correctAnswers: 8,
        date: new Date("2026-07-20T00:00:00.000Z"),
        incorrectAnswers: 2,
        score: 80,
        totalAnswers: 10,
      },
    ]);
  });
});
