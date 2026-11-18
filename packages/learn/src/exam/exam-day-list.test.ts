import { describe, expect, it } from "vitest";
import { formatExamDayList } from "./exam-day-list";

describe(formatExamDayList, () => {
  const dates = ["2027-11-14", "2027-11-21"] as const;

  it.each([
    ["de", "14. und 21. Nov. 2027"],
    ["en", "Nov 14 and 21, 2027"],
    ["pt", "14 e 21 de nov. de 2027"],
  ])("names two exam dates as separate days in %s, with one year", (locale, expected) => {
    expect(formatExamDayList({ dates, locale, today: "2026-11-17" })).toBe(expected);
  });
});
