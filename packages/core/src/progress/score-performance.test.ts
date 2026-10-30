import { describe, expect, it } from "vitest";
import {
  MIN_PATTERN_ANSWERS,
  getPatternVerdict,
  getScorePerformance,
  getScoreSpread,
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
      correctAnswers: 10,
      incorrectAnswers: 0,
      key: "perfect",
      score: 100,
      totalAnswers: 10,
    };

    expect(getStrongestScorePerformance([highVolume, perfect])).toStrictEqual(perfect);
  });

  it("leaves out groups with fewer answers than the minimum", () => {
    const lucky = {
      correctAnswers: 1,
      incorrectAnswers: 0,
      key: "lucky",
      score: 100,
      totalAnswers: 1,
    };

    const steady = {
      correctAnswers: 7,
      incorrectAnswers: 3,
      key: "steady",
      score: 70,
      totalAnswers: MIN_PATTERN_ANSWERS,
    };

    expect(getStrongestScorePerformance([lucky, steady])).toStrictEqual(steady);
  });

  it("names none while no group has the minimum", () => {
    const almost = {
      correctAnswers: MIN_PATTERN_ANSWERS - 1,
      incorrectAnswers: 0,
      key: "almost",
      score: 100,
      totalAnswers: MIN_PATTERN_ANSWERS - 1,
    };

    expect(getStrongestScorePerformance([almost])).toBeNull();
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

function group({
  score,
  totalAnswers = MIN_PATTERN_ANSWERS,
}: {
  score: number;
  totalAnswers?: number;
}) {
  const correctAnswers = Math.round((score / 100) * totalAnswers);

  return { correctAnswers, incorrectAnswers: totalAnswers - correctAnswers, score, totalAnswers };
}

describe(getPatternVerdict, () => {
  it("names the best group when it stands out from the others that count", () => {
    const best = group({ score: 90 });
    const patterns = [group({ score: 70 }), best, group({ score: 60 })];

    expect(getPatternVerdict({ patterns, strongest: best })).toStrictEqual({ best, kind: "best" });
  });

  it("calls groups a few points apart even, with how close they are", () => {
    const best = group({ score: 73 });
    const patterns = [group({ score: 69.4 }), best, group({ score: 71 })];

    expect(getPatternVerdict({ patterns, strongest: best })).toStrictEqual({
      kind: "even",
      points: 4,
    });
  });

  it("names none while fewer than two groups have enough answers to compare", () => {
    const only = group({ score: 80 });
    const lucky = group({ score: 100, totalAnswers: 1 });

    expect(getPatternVerdict({ patterns: [only, lucky], strongest: only })).toStrictEqual({
      kind: "notEnough",
    });

    expect(getPatternVerdict({ patterns: [lucky], strongest: null })).toStrictEqual({
      kind: "notEnough",
    });
  });

  it("reports identical scores as zero points apart", () => {
    const first = group({ score: 70 });
    const second = group({ score: 70 });

    expect(getPatternVerdict({ patterns: [first, second], strongest: first })).toStrictEqual({
      kind: "even",
      points: 0,
    });
  });

  it("leaves a lucky group with too few answers out of the comparison", () => {
    const best = group({ score: 90 });
    const patterns = [group({ score: 60 }), best, group({ score: 100, totalAnswers: 1 })];

    expect(getPatternVerdict({ patterns, strongest: best })).toStrictEqual({ best, kind: "best" });
  });
});

describe(getScoreSpread, () => {
  it("spans the lowest and highest score of the groups that count", () => {
    const rows = [
      group({ score: 60 }),
      group({ score: 100, totalAnswers: 1 }),
      group({ score: 85 }),
    ];

    expect(getScoreSpread(rows)).toStrictEqual({ high: 85, low: 60 });
  });

  it("is null while fewer than two groups count", () => {
    expect(
      getScoreSpread([group({ score: 60 }), group({ score: 90, totalAnswers: 1 })]),
    ).toBeNull();
  });
});
