import { describe, expect, it } from "vitest";
import { parsePlanPhases } from "../../plans/planner/plan-state";
import {
  getExamDayChecklist,
  getExamStage,
  getFinalStretchStart,
  isInFinalStretch,
} from "./final-stretch-rules";

function day(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

const ENEM_DAYS = [day("2026-11-15"), day("2026-11-08")];

describe(getExamStage, () => {
  const finalStretchStart = day("2026-10-25");

  it.each([
    ["2026-10-01", "preparing"],
    ["2026-10-24", "preparing"],
    ["2026-10-25", "finalStretch"],
    ["2026-11-07", "dayBefore"],
    ["2026-11-08", "examDay"],
    ["2026-11-10", "finalStretch"],
    ["2026-11-15", "examDay"],
    ["2026-11-16", "afterExam"],
  ] as const)("on %s is %s", (today, stage) => {
    expect(getExamStage({ examDays: ENEM_DAYS, finalStretchStart, today: day(today) })).toBe(stage);
  });

  it("keeps a plan without a final stretch learning until the day before", () => {
    const classTest = [day("2026-10-01")];

    expect(getExamStage({ examDays: classTest, today: day("2026-09-28") })).toBe("preparing");
    expect(getExamStage({ examDays: classTest, today: day("2026-09-30") })).toBe("dayBefore");
  });

  it("is preparing without a date", () => {
    expect(getExamStage({ examDays: [], finalStretchStart, today: day("2026-11-16") })).toBe(
      "preparing",
    );
  });
});

describe(getFinalStretchStart, () => {
  it("is the first day of the plan's final-stretch phase", () => {
    const phases = parsePlanPhases([
      { endDate: "2026-10-24", kind: "practice", startDate: "2026-10-01" },
      { endDate: "2026-11-07", kind: "finalStretch", startDate: "2026-10-25" },
    ]);

    expect(getFinalStretchStart(phases)).toStrictEqual(day("2026-10-25"));
    expect(getFinalStretchStart(phases.slice(0, 1))).toBeNull();
  });
});

describe(isInFinalStretch, () => {
  it("covers the plan's final stretch up to the exam day", () => {
    const finalStretchStart = day("2026-10-25");
    const targetDate = day("2026-11-08");

    const inStretch = (today: string) =>
      isInFinalStretch({ finalStretchStart, targetDate, today: day(today) });

    expect([
      inStretch("2026-10-24"),
      inStretch("2026-10-25"),
      inStretch("2026-11-08"),
    ]).toStrictEqual([false, true, true]);

    expect(inStretch("2026-11-09")).toBe(false);

    expect(
      isInFinalStretch({ finalStretchStart: null, targetDate, today: day("2026-11-01") }),
    ).toBe(false);
  });
});

describe(getExamDayChecklist, () => {
  it("lists the official exam day's needs only from a notice, and a class test's own short list", () => {
    expect(getExamDayChecklist({ ownerId: null })).toContain("documents");
    expect(getExamDayChecklist({ ownerId: "learner" })).toStrictEqual(["materials", "sleep"]);
  });

  it("has no checklist for a test no notice or material describes", () => {
    expect(getExamDayChecklist(null)).toStrictEqual([]);
  });
});
