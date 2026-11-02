import { describe, expect, it } from "vitest";
import { getWeekShape } from "./week-shape";

describe(getWeekShape, () => {
  it("reads the weekend's own time when Saturday has more and Sunday is off", () => {
    expect(
      getWeekShape({ dailyMinutes: 120, weekdayMinutes: [0, 120, 120, 120, 120, 120, 240] }),
    ).toStrictEqual({
      canDiffer: true,
      weekdayDays: [1, 2, 3, 4, 5],
      weekdays: 120,
      weekend: 240,
      weekendDays: [6],
    });
  });

  it("has no weekend time of its own when every day takes the daily time", () => {
    expect(getWeekShape({ dailyMinutes: 45, weekdayMinutes: null })).toStrictEqual({
      canDiffer: true,
      weekdayDays: [1, 2, 3, 4, 5],
      weekdays: 45,
      weekend: null,
      weekendDays: [0, 6],
    });
  });

  it("can't tell the weekend apart from a week studied only on weekends, or only on weekdays", () => {
    expect(
      getWeekShape({ dailyMinutes: 60, weekdayMinutes: [60, 0, 0, 0, 0, 0, 60] }),
    ).toMatchObject({ canDiffer: false, weekend: null });

    expect(
      getWeekShape({ dailyMinutes: 30, weekdayMinutes: [0, 30, 30, 30, 30, 30, 0] }),
    ).toMatchObject({ canDiffer: false, weekend: null });
  });

  it("takes the most common weekday time when one weekday differs", () => {
    expect(
      getWeekShape({ dailyMinutes: 60, weekdayMinutes: [90, 60, 60, 30, 60, 60, 90] }),
    ).toMatchObject({ weekdays: 60, weekend: 90 });
  });
});
