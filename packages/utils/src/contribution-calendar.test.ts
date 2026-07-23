import { describe, expect, it } from "vitest";
import {
  getContributionCalendarDateKey,
  getContributionCalendarDateRange,
  getContributionCalendarDates,
  getContributionCalendarKeyboardStartDate,
  getContributionCalendarMonthDate,
  getContributionCalendarWeekKey,
  groupContributionCalendarDaysByWeek,
} from "./contribution-calendar";

describe(getContributionCalendarDateKey, () => {
  it("preserves the UTC calendar date without its time", () => {
    expect(getContributionCalendarDateKey(new Date("2026-07-23T23:59:59.999Z"))).toBe("2026-07-23");
  });
});

describe(getContributionCalendarDates, () => {
  it("returns every UTC date in an inclusive contribution range", () => {
    expect(
      getContributionCalendarDates({
        endDate: new Date("2026-07-23T00:00:00.000Z"),
        startDate: new Date("2026-07-21T00:00:00.000Z"),
      }),
    ).toStrictEqual([
      new Date("2026-07-21T00:00:00.000Z"),
      new Date("2026-07-22T00:00:00.000Z"),
      new Date("2026-07-23T00:00:00.000Z"),
    ]);
  });
});

describe(groupContributionCalendarDaysByWeek, () => {
  it("keeps each vertical contribution column aligned to seven days", () => {
    const days = Array.from({ length: 9 }, (_, dayIndex) => ({ dayIndex }));

    expect(groupContributionCalendarDaysByWeek(days)).toStrictEqual([
      days.slice(0, 7),
      days.slice(7),
    ]);
  });
});

describe(getContributionCalendarMonthDate, () => {
  it("returns the first day of the month from a contribution week", () => {
    const monthStart = new Date("2025-02-01T00:00:00Z");

    expect(
      getContributionCalendarMonthDate([
        { date: new Date("2025-01-30T00:00:00Z") },
        { date: new Date("2025-01-31T00:00:00Z") },
        { date: monthStart },
      ]),
    ).toStrictEqual(monthStart);
  });

  it("returns null when the first day of the month is outside the week", () => {
    expect(
      getContributionCalendarMonthDate([
        { date: new Date("2025-02-02T00:00:00Z") },
        { date: new Date("2025-02-03T00:00:00Z") },
      ]),
    ).toBeNull();
  });
});

describe(getContributionCalendarWeekKey, () => {
  it("uses the first calendar date as the stable week identity", () => {
    expect(
      getContributionCalendarWeekKey([
        { date: new Date("2025-02-02T00:00:00Z") },
        { date: new Date("2025-02-03T00:00:00Z") },
      ]),
    ).toBe("2025-02-02T00:00:00.000Z");
  });
});

describe(getContributionCalendarKeyboardStartDate, () => {
  const days = [
    { date: new Date("2025-02-02T00:00:00Z"), value: null },
    { date: new Date("2025-02-03T00:00:00Z"), value: 1 },
    { date: new Date("2025-02-04T00:00:00Z"), value: null },
  ];

  it("starts on the newest date that the caller considers active", () => {
    expect(
      getContributionCalendarKeyboardStartDate({ days, hasActivity: (day) => day.value !== null }),
    ).toStrictEqual(days[1]?.date);
  });

  it("falls back to the newest visible date when no date is active", () => {
    expect(
      getContributionCalendarKeyboardStartDate({ days, hasActivity: () => false }),
    ).toStrictEqual(days[2]?.date);
  });
});

describe(getContributionCalendarDateRange, () => {
  it("normalizes the current instant to a UTC date-only range", () => {
    const range = getContributionCalendarDateRange({ now: new Date("2026-07-23T18:30:00.000Z") });

    expect(range).toStrictEqual({
      endDate: new Date("2026-07-23T00:00:00.000Z"),
      startDate: new Date("2025-07-20T00:00:00.000Z"),
    });
  });

  it("uses the current date in a timezone ahead of UTC", () => {
    const range = getContributionCalendarDateRange({
      now: new Date("2026-07-23T18:30:00.000Z"),
      timeZone: "Pacific/Kiritimati",
    });

    expect(range).toStrictEqual({
      endDate: new Date("2026-07-24T00:00:00.000Z"),
      startDate: new Date("2025-07-20T00:00:00.000Z"),
    });
  });

  it("uses the current date in a timezone behind UTC", () => {
    const range = getContributionCalendarDateRange({
      now: new Date("2026-07-23T02:30:00.000Z"),
      timeZone: "America/Los_Angeles",
    });

    expect(range).toStrictEqual({
      endDate: new Date("2026-07-22T00:00:00.000Z"),
      startDate: new Date("2025-07-20T00:00:00.000Z"),
    });
  });
});
