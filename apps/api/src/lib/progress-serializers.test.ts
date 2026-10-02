import { describe, expect, it } from "vitest";
import { serializeLevel, serializeScorePatterns } from "./progress-serializers";

const PERFORMANCE = { correctAnswers: 3, incorrectAnswers: 1, score: 75, totalAnswers: 4 };

describe("progress API serializers", () => {
  it("publishes belt identity without prescribing a presentation color", () => {
    const level = serializeLevel({
      bpPerLevel: 1000,
      bpToNextLevel: 500,
      color: "orange",
      isMaxLevel: false,
      level: 8,
      progressInLevel: 500,
      totalBrainPower: 15_000,
    });

    expect(level).toStrictEqual({
      belt: "orange",
      bpPerLevel: 1000,
      bpToNextLevel: 500,
      isMaxLevel: false,
      level: 8,
      progressInLevel: 500,
      totalBrainPower: 15_000,
    });

    expect(level).not.toHaveProperty("color");
  });

  it("uses semantic weekday and daypart identifiers in complete Score patterns", () => {
    const patterns = serializeScorePatterns({
      strongestTime: { ...PERFORMANCE, period: 1 },
      strongestWeekday: { ...PERFORMANCE, dayOfWeek: 1 },
      times: [0, 1, 2, 3].map((period) => ({ ...PERFORMANCE, period })),
      weekdays: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ ...PERFORMANCE, dayOfWeek })),
    });

    expect(patterns.strongestTime?.period).toBe("morning");
    expect(patterns.strongestWeekday?.dayOfWeek).toBe("monday");

    expect(patterns.times.map((pattern) => pattern.period)).toStrictEqual([
      "night",
      "morning",
      "afternoon",
      "evening",
    ]);

    expect(patterns.weekdays.map((pattern) => pattern.dayOfWeek)).toStrictEqual([
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ]);
  });
});
