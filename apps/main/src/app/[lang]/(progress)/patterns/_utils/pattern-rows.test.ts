import { describe, expect, it } from "vitest";
import { getCompleteTimePatterns, getCompleteWeekdayPatterns } from "./pattern-rows";

const OBSERVED_PERFORMANCE = {
  correctAnswers: 8,
  incorrectAnswers: 2,
  score: 80,
  totalAnswers: 10,
};

describe(getCompleteWeekdayPatterns, () => {
  it("keeps observed performance and fills every missing weekday without inventing answers", () => {
    const patterns = getCompleteWeekdayPatterns([
      { ...OBSERVED_PERFORMANCE, dayOfWeek: 2 },
      { ...OBSERVED_PERFORMANCE, dayOfWeek: 5 },
    ]);

    expect(patterns).toHaveLength(7);
    expect(patterns[2]).toStrictEqual({ ...OBSERVED_PERFORMANCE, dayOfWeek: 2 });

    expect(patterns[0]).toStrictEqual({
      correctAnswers: 0,
      dayOfWeek: 0,
      incorrectAnswers: 0,
      score: 0,
      totalAnswers: 0,
    });
  });
});

describe(getCompleteTimePatterns, () => {
  it("keeps observed performance and fills every missing time period without inventing answers", () => {
    const patterns = getCompleteTimePatterns([{ ...OBSERVED_PERFORMANCE, period: 1 }]);

    expect(patterns).toHaveLength(4);
    expect(patterns[1]).toStrictEqual({ ...OBSERVED_PERFORMANCE, period: 1 });

    expect(patterns[0]).toStrictEqual({
      correctAnswers: 0,
      incorrectAnswers: 0,
      period: 0,
      score: 0,
      totalAnswers: 0,
    });
  });
});
