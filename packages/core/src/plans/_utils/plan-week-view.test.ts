import { describe, expect, it } from "vitest";
import { type ExistingPlanItem } from "../planner/plan-items";
import { type PlanReadItem } from "./plan-read-projection";
import { buildWeekView } from "./plan-week-view";

/** A Wednesday: Monday and Tuesday are behind, the rest of the week ahead. */
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
  items?: PlanReadItem[];
  startDate?: Date;
  studiedDates?: string[];
}) {
  return buildWeekView({
    access: { mocksRequirePlus: false },
    calendar: { dailyMinutes: 30, firstDay: null, lightWeeks: [], weekdayMinutes: null },
    exam: null,
    items,
    skillAreas: new Map([["skill-stock", "Stock market"]]),
    startDate,
    studiedDates: new Set(studiedDates),
    targetDate: null,
    today: TODAY,
  });
}

describe(buildWeekView, () => {
  it("projects a saved multi-day allocation onto each shown day", () => {
    const item = {
      ...lesson("2026-09-23", "todo"),
      facts: {
        days: [
          ["2026-09-23", 10, 8],
          ["2026-09-24", 20, 12],
        ],
        minutes: 30,
        parts: { checkpoint: 0, practice: 10, unwritten: 0, written: 20 },
        schemaVersion: 1,
        skillIds: [],
      },
      minutes: 30,
    };

    const { days } = buildWeek({ items: [item] });
    expect(days[2]?.items).toMatchObject([{ id: item.id, minutes: 10 }]);
    expect(days[3]?.items).toMatchObject([{ id: item.id, minutes: 20 }]);
  });

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

  it("never counts a past day whose lessons were set aside as done", () => {
    const { days } = buildWeek({
      items: [
        lesson("2026-09-21", "done"),
        { ...lesson("2026-09-21", "skipped"), id: "set-aside" },
        lesson("2026-09-22", "testedOut"),
      ],
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

  it("counts the lessons each day holds, estimating a day's share of lessons still to be written", () => {
    const standIn = {
      ...lesson("2026-09-28", "todo"),
      facts: {
        days: [
          ["2026-09-23", 15, 7.5],
          ["2026-09-24", 15, 7.5],
          ["2026-09-28", 5, 2.5],
        ],
        minutes: 200,
        parts: { checkpoint: 0, practice: 100, unwritten: 100, written: 0 },
        schemaVersion: 1,
        skillIds: ["skill-stock"],
      },
      lessons: 25,
      minutes: 200,
      skillId: "skill-stock",
    };

    const written = { ...lesson("2026-09-25", "todo"), id: "written", lessonId: "lesson-1" };

    const challenge = {
      ...lesson("2026-09-25", "todo"),
      id: "challenge",
      kind: "checkpoint" as const,
    };

    const { days } = buildWeek({ items: [standIn, written, challenge] });

    expect(days.slice(2, 5).map(({ items }) => items.map((item) => item.lessons))).toStrictEqual([
      [2],
      [2],
      [1, 0],
    ]);
  });

  it("never counts more lessons across a week than a topic still to be written holds", () => {
    const standIn = {
      ...lesson("2026-09-21", "todo"),
      facts: {
        days: [
          ["2026-09-21", 5, 5],
          ["2026-09-22", 5, 5],
          ["2026-09-23", 5, 5],
          ["2026-09-24", 5, 5],
        ],
        minutes: 20,
        parts: { checkpoint: 0, practice: 0, unwritten: 20, written: 0 },
        schemaVersion: 1,
        skillIds: ["skill-stock"],
      },
      lessons: 3,
      minutes: 20,
      skillId: "skill-stock",
    };

    const { days } = buildWeek({ items: [standIn] });
    const counts = days.flatMap(({ items }) => items.map((item) => item.lessons));

    expect(counts.reduce((sum, count) => sum + count, 0)).toBe(3);
  });

  it("counts a kept topic's lessons by the minutes its saved days hold", () => {
    const standIn = {
      ...lesson("2026-09-21", "todo"),
      facts: {
        days: [
          ["2026-09-21", 10, 5],
          ["2026-09-22", 10, 5],
        ],
        minutes: 20,
        parts: { checkpoint: 0, practice: 10, unwritten: 10, written: 0 },
        schemaVersion: 1,
        skillIds: ["skill-stock"],
      },
      lessons: 4,
      minutes: 10,
      skillId: "skill-stock",
    };

    const { days } = buildWeek({ items: [standIn] });
    const counts = days.flatMap(({ items }) => items.map((item) => item.lessons));

    expect(counts).toStrictEqual([2, 2]);
  });
});
