import { describe, expect, it } from "vitest";
import { type ExistingPlanItem } from "../planner/plan-items";
import { buildWeekView } from "./plan-week-view";

/** Wednesday, Sep 23, 2026: Monday and Tuesday are behind, the rest of the week ahead. */
const TODAY = new Date("2026-09-23T00:00:00Z");
const MONDAY = new Date("2026-09-21T00:00:00Z");

function lesson(scheduledFor: string, status: ExistingPlanItem["status"]): ExistingPlanItem {
  return {
    chapterId: null,
    completedAt: null,
    id: `item-${scheduledFor}`,
    kind: "lesson",
    lessonId: null,
    phase: 0,
    position: 0,
    scheduledFor: new Date(`${scheduledFor}T00:00:00Z`),
    skillId: null,
    status,
    titleSnapshot: "Percentages",
  };
}

function buildWeek({
  items = [],
  startDate = MONDAY,
  studiedDates = [],
}: {
  items?: ExistingPlanItem[];
  startDate?: Date;
  studiedDates?: string[];
}) {
  return buildWeekView({
    access: { freeUntil: null, mocksRequirePlus: false },
    calendar: { dailyMinutes: 30, lightWeeks: [], weekdayMinutes: null },
    exam: null,
    items,
    minutes: new Map(),
    skillAreas: new Map([["skill-stock", "Stock market"]]),
    startDate,
    studiedDates: new Set(studiedDates),
    targetDate: null,
    today: TODAY,
  });
}

describe(buildWeekView, () => {
  it("counts a past day with nothing scheduled as done only when the learner studied", () => {
    const { days } = buildWeek({ studiedDates: ["2026-09-21"] });

    expect(days.slice(0, 3).map((day) => day.state)).toStrictEqual(["done", "rest", "today"]);
  });

  it("keeps the days before the goal started neutral, with no time to study", () => {
    const { days } = buildWeek({ startDate: TODAY, studiedDates: ["2026-09-21"] });

    expect(days.slice(0, 3).map(({ minutes, state }) => ({ minutes, state }))).toStrictEqual([
      { minutes: 0, state: "rest" },
      { minutes: 0, state: "rest" },
      { minutes: 30, state: "today" },
    ]);
  });

  it("follows a past day's items when it has some", () => {
    const { days } = buildWeek({
      items: [lesson("2026-09-21", "todo"), lesson("2026-09-22", "done")],
      studiedDates: ["2026-09-21"],
    });

    expect(days.slice(0, 2).map((day) => day.state)).toStrictEqual(["missed", "done"]);
  });

  it("names a skill whose lessons are being written by its course, not its raw name", () => {
    const standIn = {
      ...lesson("2026-09-23", "todo"),
      skillId: "skill-stock",
      titleSnapshot: "Explain market liquidity",
    };

    const written = { ...lesson("2026-09-23", "todo"), id: "written", lessonId: "lesson-1" };
    const { days } = buildWeek({ items: [standIn, written] });

    expect(days[2]?.items.map(({ title, writing }) => ({ title, writing }))).toStrictEqual([
      { title: "Stock market", writing: true },
      { title: "Percentages", writing: false },
    ]);
  });
});
