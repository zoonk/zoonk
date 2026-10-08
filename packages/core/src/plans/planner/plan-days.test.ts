import { describe, expect, it } from "vitest";
import { fromIsoDate } from "./plan-calendar";
import { createExamDays, getPlannedMinutes } from "./plan-days";
import { getExamWindows } from "./plan-phases";

const calendar = {
  dailyMinutes: 45,
  firstDay: null,
  lightWeeks: [{ endDate: "2026-10-11", startDate: "2026-10-05" }],
  weekdayMinutes: [0, 45, 45, 45, 45, 45, 45],
};

const TARGET = fromIsoDate("2026-11-08");

function minutesOn(date: string, isExam = true) {
  return getPlannedMinutes({
    calendar,
    date: fromIsoDate(date),
    exam: isExam ? { planStart: fromIsoDate("2026-09-28"), shortMockMinutes: null } : null,
    targetDate: TARGET,
  });
}

describe(getPlannedMinutes, () => {
  it("follows the week, rest days and light weeks", () => {
    expect(minutesOn("2026-09-28")).toBe(45);
    expect(minutesOn("2026-10-04")).toBe(0);
    expect(minutesOn("2026-10-06")).toBe(23);
  });

  it("keeps the day before an exam light and plans nothing from the exam on", () => {
    expect(minutesOn("2026-11-07")).toBe(15);
    expect(minutesOn("2026-11-08")).toBe(0);
    expect(minutesOn("2026-11-07", false)).toBe(45);
  });
});

describe(createExamDays, () => {
  it("gives a class test a few days away its short mock the day before, and nothing else", () => {
    const targetDate = fromIsoDate("2026-10-02");
    const planStart = fromIsoDate("2026-09-30");

    const dayShape = createExamDays({
      calendar: { dailyMinutes: 45, firstDay: null, lightWeeks: [], weekdayMinutes: null },
      eventWeekday: 0,
      mockMinutes: 150,
      practiceBias: "balanced",
      rules: { planStart, shortMockMinutes: 30 },
      targetDate,
      windows: getExamWindows({ planStart, targetDate }),
    });

    expect(dayShape(fromIsoDate("2026-10-01"))).toMatchObject({
      events: [
        { kind: "mock", minutes: 30, replacesDay: true },
        { kind: "review", minutes: 15 },
      ],
      minutes: 45,
      open: false,
    });

    expect(dayShape(fromIsoDate("2026-09-30")).events).toStrictEqual([]);
  });
});
