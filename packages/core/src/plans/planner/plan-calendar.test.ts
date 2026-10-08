import { describe, expect, it } from "vitest";
import {
  countStudyDays,
  fromIsoDate,
  getEndOfWeek,
  getStartOfWeek,
  getStudyMinutes,
  getWeeklyEventWeekday,
  scaleWeekdayMinutes,
  toIsoDate,
} from "./plan-calendar";

const day = (value: string) => fromIsoDate(value);

describe(getEndOfWeek, () => {
  it("runs weeks from Monday to Sunday", () => {
    expect(toIsoDate(getEndOfWeek(day("2026-09-28")))).toBe("2026-10-04");
    expect(toIsoDate(getEndOfWeek(day("2026-10-03")))).toBe("2026-10-04");
    expect(toIsoDate(getEndOfWeek(day("2026-10-04")))).toBe("2026-10-04");
    expect(toIsoDate(getStartOfWeek(day("2026-09-28")))).toBe("2026-09-28");
    expect(toIsoDate(getStartOfWeek(day("2026-09-30")))).toBe("2026-09-28");
    expect(toIsoDate(getStartOfWeek(day("2026-10-04")))).toBe("2026-09-28");
  });
});

describe(getStudyMinutes, () => {
  const calendar = {
    dailyMinutes: 45,
    firstDay: null,
    lightWeeks: [{ endDate: "2026-10-11", startDate: "2026-10-05" }],
    weekdayMinutes: [0, 45, 45, 45, 45, 45, 20],
  };

  it("gives the plan's first day study time even when its weekday rests, and only that day", () => {
    const fromSunday = { ...calendar, firstDay: day("2026-10-04") };

    expect(getStudyMinutes({ calendar: fromSunday, date: day("2026-10-04") })).toBe(45);
    expect(getStudyMinutes({ calendar: fromSunday, date: day("2026-10-11") })).toBe(0);
    expect(getStudyMinutes({ calendar: fromSunday, date: day("2026-10-03") })).toBe(20);
  });

  it("uses each weekday's minutes, with rest days at zero", () => {
    expect(getStudyMinutes({ calendar, date: day("2026-09-28") })).toBe(45);
    expect(getStudyMinutes({ calendar, date: day("2026-10-03") })).toBe(20);
    expect(getStudyMinutes({ calendar, date: day("2026-10-04") })).toBe(0);
  });

  it("halves the time in a light week", () => {
    expect(getStudyMinutes({ calendar, date: day("2026-10-05") })).toBe(23);
    expect(getStudyMinutes({ calendar, date: day("2026-10-12") })).toBe(45);
  });

  it("uses the daily minutes every day without a weekly shape", () => {
    const even = { dailyMinutes: 30, firstDay: null, lightWeeks: [], weekdayMinutes: null };

    expect(getStudyMinutes({ calendar: even, date: day("2026-10-04") })).toBe(30);
    expect(countStudyDays(even)).toBe(7);
    expect(countStudyDays(calendar)).toBe(6);
  });
});

describe(getWeeklyEventWeekday, () => {
  it("is the week's last study day, never a rest day", () => {
    expect(getWeeklyEventWeekday({ dailyMinutes: 30, weekdayMinutes: null })).toBe(0);

    // Sunday rests: Saturday, the nearest study day, ends the week.
    expect(
      getWeeklyEventWeekday({ dailyMinutes: 30, weekdayMinutes: [0, 30, 30, 30, 30, 30, 30] }),
    ).toBe(6);

    expect(
      getWeeklyEventWeekday({ dailyMinutes: 30, weekdayMinutes: [0, 30, 30, 30, 30, 30, 0] }),
    ).toBe(5);

    expect(
      getWeeklyEventWeekday({ dailyMinutes: 30, weekdayMinutes: [30, 30, 0, 30, 0, 30, 30] }),
    ).toBe(0);
  });
});

describe(scaleWeekdayMinutes, () => {
  it("keeps the week's shape when the daily time changes", () => {
    expect(
      scaleWeekdayMinutes({
        dailyMinutes: 60,
        from: 30,
        weekdayMinutes: [0, 30, 30, 30, 30, 30, 15],
      }),
    ).toStrictEqual([0, 60, 60, 60, 60, 60, 30]);

    expect(scaleWeekdayMinutes({ dailyMinutes: 60, from: 30, weekdayMinutes: null })).toBeNull();
  });
});
