import { describe, expect, it } from "vitest";
import { getBlockMinutes, getWeekDays } from "./daily-goal";

const WEDNESDAY = new Date("2026-09-30T00:00:00Z");

describe(getWeekDays, () => {
  it("shows each day's minutes, whether it hit the goal and partial days as studied", () => {
    const week = getWeekDays({
      days: [
        { date: new Date("2026-09-28T00:00:00Z"), seconds: 45 * 60 },
        { date: new Date("2026-09-29T00:00:00Z"), seconds: 18 * 60 + 30 },
        { date: new Date("2026-09-21T00:00:00Z"), seconds: 3600 },
      ],
      // Sundays are rest days in this plan.
      getGoalMinutes: (date) => (date.getUTCDay() === 0 ? 0 : 45),
      today: WEDNESDAY,
    });

    expect(week).toHaveLength(7);
    expect(week.at(-1)).toMatchObject({ goalMinutes: 0, hitGoal: false });

    expect(week.slice(0, 3)).toStrictEqual([
      {
        date: new Date("2026-09-28T00:00:00Z"),
        goalMinutes: 45,
        hitGoal: true,
        isToday: false,
        minutes: 45,
        studied: true,
      },
      {
        date: new Date("2026-09-29T00:00:00Z"),
        goalMinutes: 45,
        hitGoal: false,
        isToday: false,
        minutes: 18,
        studied: true,
      },
      {
        date: WEDNESDAY,
        goalMinutes: 45,
        hitGoal: false,
        isToday: true,
        minutes: 0,
        studied: false,
      },
    ]);
  });
});

describe(getBlockMinutes, () => {
  it("counts time from start to finish, capped at twice the estimate", () => {
    const startedAt = new Date("2026-09-30T10:00:00Z");

    expect(
      getBlockMinutes({
        completedAt: new Date("2026-09-30T10:06:00Z"),
        estimatedMinutes: 5,
        startedAt,
      }),
    ).toBe(6);

    expect(
      getBlockMinutes({
        completedAt: new Date("2026-09-30T12:00:00Z"),
        estimatedMinutes: 5,
        startedAt,
      }),
    ).toBe(10);
  });

  it("counts nothing for unfinished blocks and the estimate without a start", () => {
    expect(getBlockMinutes({ completedAt: null, estimatedMinutes: 5, startedAt: null })).toBe(0);

    expect(getBlockMinutes({ completedAt: WEDNESDAY, estimatedMinutes: 5, startedAt: null })).toBe(
      5,
    );
  });
});
