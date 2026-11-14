import { describe, expect, it } from "vitest";
import {
  daysUntilIsoDate,
  getIsoDateOptions,
  getIsoRangeOptions,
  hasIsoDatePassed,
  isoDateToUtc,
} from "./iso-date";

function formatInEnglish(
  isoDate: string,
  style: Parameters<typeof getIsoDateOptions>[0]["style"],
  today: string,
) {
  return new Intl.DateTimeFormat("en-US", getIsoDateOptions({ isoDate, style, today })).format(
    isoDateToUtc(isoDate),
  );
}

describe(daysUntilIsoDate, () => {
  it("counts whole days from the viewer's calendar day, whatever the time of day", () => {
    const lateEvening = new Date(2026, 8, 28, 23, 30);
    const earlyMorning = new Date(2026, 8, 28, 0, 15);

    expect(daysUntilIsoDate({ isoDate: "2026-09-30", today: lateEvening })).toBe(2);
    expect(daysUntilIsoDate({ isoDate: "2026-09-30", today: earlyMorning })).toBe(2);
    expect(daysUntilIsoDate({ isoDate: "2026-11-08", today: earlyMorning })).toBe(41);
  });

  it("never counts below zero for today or a day already past", () => {
    const today = new Date(2026, 8, 28, 12, 0);

    expect(daysUntilIsoDate({ isoDate: "2026-09-28", today })).toBe(0);
    expect(daysUntilIsoDate({ isoDate: "2026-09-01", today })).toBe(0);
  });
});

describe(hasIsoDatePassed, () => {
  it("has passed from the day after the date, by the viewer's calendar day", () => {
    const lateOnTheDay = new Date(2026, 9, 12, 23, 30);
    const earlyNextDay = new Date(2026, 9, 13, 0, 15);

    expect(hasIsoDatePassed({ isoDate: "2026-10-12", today: lateOnTheDay })).toBe(false);
    expect(hasIsoDatePassed({ isoDate: "2026-10-12", today: earlyNextDay })).toBe(true);
    expect(hasIsoDatePassed({ isoDate: "2026-10-20", today: earlyNextDay })).toBe(false);
  });
});

describe(getIsoDateOptions, () => {
  const today = "2026-12-31";

  it.each([
    { expected: "Monday, January 4, 2027", style: "weekdayDay" },
    { expected: "Jan 4, 2027", style: "day" },
    { expected: "January 4, 2027", style: "long" },
  ] as const)("names the year of a $style date in another year", ({ expected, style }) => {
    expect(formatInEnglish("2027-01-04", style, today)).toBe(expected);
  });

  it("leaves the year out of a date this year", () => {
    expect(formatInEnglish("2026-12-14", "weekdayDay", today)).toBe("Monday, December 14");
  });
});

function formatWeek({ end, start, today }: { end: string; start: string; today: string }) {
  return new Intl.DateTimeFormat("en-US", getIsoRangeOptions({ end, start, today }))
    .formatRange(isoDateToUtc(start), isoDateToUtc(end))
    .replaceAll("\u2009", " ");
}

describe(getIsoRangeOptions, () => {
  it("names the year of a week last year", () => {
    expect(formatWeek({ end: "2026-12-27", start: "2026-12-21", today: "2027-01-01" })).toBe(
      "Dec 21 – 27, 2026",
    );
  });

  it("names both years of a week across New Year", () => {
    expect(formatWeek({ end: "2027-01-03", start: "2026-12-28", today: "2027-01-04" })).toBe(
      "Dec 28, 2026 – Jan 3, 2027",
    );
  });

  it("leaves the year out of a week this year", () => {
    expect(formatWeek({ end: "2026-11-08", start: "2026-11-02", today: "2026-11-14" })).toBe(
      "Nov 2 – 8",
    );
  });
});
