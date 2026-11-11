import { describe, expect, it } from "vitest";
import { fromIsoDate } from "./plan-calendar";
import { createExamDays, createLearnDays, getPlannedMinutes } from "./plan-days";
import { getExamWindows } from "./plan-phases";

const calendar = {
  dailyMinutes: 45,
  firstDay: null,
  lightWeeks: [],
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

function studyingEverything(date: string) {
  return getPlannedMinutes({
    calendar,
    date: fromIsoDate(date),
    exam: { fullCourse: true, planStart: fromIsoDate("2026-09-28"), shortMockMinutes: null },
    targetDate: TARGET,
  });
}

describe(getPlannedMinutes, () => {
  it("keeps the day before an exam light and plans nothing from the exam on", () => {
    expect(minutesOn("2026-11-07")).toBe(15);
    expect(minutesOn("2026-11-08")).toBe(0);
    expect(minutesOn("2026-11-09")).toBe(0);
    expect(minutesOn("2026-11-07", false)).toBe(45);
  });

  it("goes on after the exam day when the exam's plan studies everything", () => {
    expect(studyingEverything("2026-11-07")).toBe(15);
    expect(studyingEverything("2026-11-08")).toBe(0);
    expect(studyingEverything("2026-11-09")).toBe(45);
  });
});

describe(createExamDays, () => {
  it("gives a class test a few days away its short mock the day before, and nothing else", () => {
    const targetDate = fromIsoDate("2026-10-02");
    const planStart = fromIsoDate("2026-09-30");

    const dayShape = createExamDays({
      calendar: { dailyMinutes: 45, firstDay: null, lightWeeks: [], weekdayMinutes: null },
      eventWeekday: 0,
      fullMockMinutes: 300,
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

describe("a plan's original first day", () => {
  const start = fromIsoDate("2026-09-30");
  const fullDay = { dailyMinutes: 240, firstDay: start, lightWeeks: [], weekdayMinutes: null };

  it.each([null, 150])("gives all 240 minutes to lessons with mock time %s", (mockMinutes) => {
    const describeDay = createLearnDays({
      calendar: fullDay,
      eventWeekday: 0,
      mockMinutes,
      practiceBias: "balanced",
      start,
      targetDate: null,
    });

    expect(describeDay(start)).toMatchObject({ minutes: 240, open: true, share: 1 });
    expect(describeDay(fromIsoDate("2026-10-01")).share).toBe(0.5);
  });

  it("gives a dated exam's first open day all 240 minutes", () => {
    const targetDate = fromIsoDate("2026-12-30");

    const describeDay = createExamDays({
      calendar: fullDay,
      eventWeekday: 0,
      fullMockMinutes: 180,
      mockMinutes: 90,
      practiceBias: "balanced",
      rules: { planStart: start, shortMockMinutes: null },
      targetDate,
      windows: getExamWindows({ planStart: start, targetDate }),
    });

    expect(describeDay(start)).toMatchObject({ minutes: 240, open: true, share: 1 });
    expect(describeDay(fromIsoDate("2026-10-01")).share).toBe(0.6);
  });

  it("does not reopen a final-stretch day or give a continuation another first day", () => {
    const targetDate = fromIsoDate("2026-10-01");

    const describeDay = createExamDays({
      calendar: fullDay,
      eventWeekday: 0,
      fullMockMinutes: 180,
      mockMinutes: 90,
      practiceBias: "balanced",
      rules: { planStart: start, shortMockMinutes: 30 },
      targetDate,
      windows: [{ endDate: start, kind: "finalStretch", startDate: start }],
    });

    expect(describeDay(start)).toMatchObject({ open: false, share: 0 });
    const continuationStart = fromIsoDate("2026-10-02");

    const continuation = createLearnDays({
      calendar: fullDay,
      eventWeekday: 0,
      planStart: start,
      practiceBias: "balanced",
      start: continuationStart,
      targetDate: null,
    });

    expect(continuation(continuationStart).share).toBe(0.5);
  });
});
