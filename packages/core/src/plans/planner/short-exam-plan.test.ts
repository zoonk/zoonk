import { describe, expect, it } from "vitest";
import { type BuildPlanInput, buildPlan } from "./build-plan";
import { addDays, fromIsoDate, toIsoDate } from "./plan-calendar";
import { getPlannedMinutes } from "./plan-days";
import { type PlannedItem } from "./plan-items";
import { getExamWindows } from "./plan-phases";
import { type PlanGraphSkill, parsePlanSettings } from "./plan-state";
import { type PlannerLesson } from "./plan-units";
import { type SkillReadiness } from "./skill-order";

/** A Wednesday: Bia's plan starts the day she uploads her slides. */
const TODAY = fromIsoDate("2026-09-30");

/** A class test's own mock: ten questions in about half an hour. */
const SHORT_MOCK_MINUTES = 30;

const DAILY_MINUTES = 60;

/**
 * Bia's biochemistry exam map, from last year's exam: enzymes came up four times, glycolysis
 * three, the Krebs cycle and the respiratory chain twice.
 */
const SKILLS: PlanGraphSkill[] = [
  { area: "Biochemistry", lessons: 3, name: "Enzymes", phase: 0, skillId: "enzymes", weight: 4 },
  {
    area: "Biochemistry",
    lessons: 3,
    name: "Glycolysis",
    phase: 0,
    skillId: "glycolysis",
    weight: 3,
  },
  { area: "Biochemistry", lessons: 3, name: "Krebs cycle", phase: 0, skillId: "krebs", weight: 2 },
  {
    area: "Biochemistry",
    lessons: 3,
    name: "Respiratory chain",
    phase: 0,
    skillId: "chain",
    weight: 2,
  },
];

const LESSONS: PlannerLesson[] = SKILLS.flatMap((skill) =>
  Array.from({ length: skill.lessons }, (_, index) => ({
    chapterId: `chapter-${skill.skillId}`,
    lessonId: `${skill.skillId}-${index}`,
    minutes: 4,
    skillIds: [skill.skillId],
    title: `${skill.name} ${index + 1}`,
  })),
);

/** Placement found glycolysis solid: the plan starts with what she doesn't know yet. */
const READINESS = new Map<string, SkillReadiness>([
  ["glycolysis", { reps: 3, retrievabilityAtTarget: 0.95, stability: 30, state: "solid" }],
]);

function classTest({
  days,
  shortMockMinutes = SHORT_MOCK_MINUTES,
}: {
  days: number;
  shortMockMinutes?: number | null;
}): BuildPlanInput {
  return {
    goal: { dailyMinutes: DAILY_MINUTES, kind: "exam", targetDate: addDays(TODAY, days) },
    graph: { phases: [{ milestone: null, name: "Biochemistry" }], skills: SKILLS },
    items: [],
    lessons: LESSONS,
    mockMinutes: 15,
    mode: "forced",
    paceFactor: 1,
    prerequisites: new Map(),
    readiness: READINESS,
    settings: parsePlanSettings({ shortMockMinutes, startDate: toIsoDate(TODAY) }),
    today: TODAY,
  };
}

function datesOf({ items, kind }: { items: readonly PlannedItem[]; kind: PlannedItem["kind"] }) {
  return items
    .filter((item) => item.kind === kind)
    .map((item) => (item.scheduledFor ? toIsoDate(item.scheduledFor) : null));
}

function lessonDates(items: readonly PlannedItem[]) {
  return new Set(datesOf({ items, kind: "lesson" }));
}

function windowsFor(days: number) {
  return getExamWindows({ planStart: TODAY, targetDate: addDays(TODAY, days) }).map((window) => ({
    days: Math.round((window.endDate.getTime() - window.startDate.getTime()) / 86_400_000) + 1,
    kind: window.kind,
  }));
}

describe("the phases of a test days away", () => {
  it("goes to the map and gaps, then practice, and keeps the day before on its own", () => {
    expect(windowsFor(1)).toStrictEqual([{ days: 1, kind: "gaps" }]);

    expect(windowsFor(2)).toStrictEqual([
      { days: 1, kind: "gaps" },
      { days: 1, kind: "finalStretch" },
    ]);

    expect(windowsFor(3)).toStrictEqual([
      { days: 1, kind: "gaps" },
      { days: 1, kind: "practice" },
      { days: 1, kind: "finalStretch" },
    ]);

    expect(windowsFor(7)).toStrictEqual([
      { days: 4, kind: "gaps" },
      { days: 2, kind: "practice" },
      { days: 1, kind: "finalStretch" },
    ]);
  });

  it("keeps the four phases once the test is more than a week away", () => {
    expect(windowsFor(8).map((window) => window.kind)).toStrictEqual([
      "foundations",
      "gaps",
      "practice",
      "finalStretch",
    ]);
  });
});

describe("a class test days away", () => {
  it("in three days: the gaps first, practice, then the short mock the day before", () => {
    const plan = buildPlan(classTest({ days: 3 }));
    const lessons = plan.items.filter((item) => item.kind === "lesson");

    expect(plan.phases.map((phase) => phase.kind)).toStrictEqual([
      "gaps",
      "practice",
      "finalStretch",
    ]);

    expect(lessons[0]?.skillId).toBe("enzymes");
    expect(lessons.at(-1)?.skillId).toBe("glycolysis");
    expect(datesOf({ items: plan.items, kind: "boss" })).toStrictEqual([]);
    expect(datesOf({ items: plan.items, kind: "mock" })).toStrictEqual(["2026-10-02"]);
    expect(datesOf({ items: plan.items, kind: "review" })).toStrictEqual(["2026-10-02"]);
    expect(lessonDates(plan.items).has("2026-10-02")).toBe(false);
    expect(plan.items.find((item) => item.kind === "mock")?.minutes).toBe(SHORT_MOCK_MINUTES);
  });

  it("fits the short mock to a day the learner gives less time, without a review after it", () => {
    const input = classTest({ days: 2 });

    // Fifteen minutes on Thursday, the day before the test.
    const plan = buildPlan({
      ...input,
      settings: parsePlanSettings({
        shortMockMinutes: SHORT_MOCK_MINUTES,
        startDate: toIsoDate(TODAY),
        weekdayMinutes: [60, 60, 60, 60, 15, 60, 60],
      }),
    });

    expect(plan.items.find((item) => item.kind === "mock")).toMatchObject({ minutes: 15 });
    expect(datesOf({ items: plan.items, kind: "review" })).toStrictEqual([]);
  });

  it("in seven days: four days of map and gaps, two of practice, and the mock the day before", () => {
    const plan = buildPlan(classTest({ days: 7 }));

    expect(plan.phases.map((phase) => [phase.kind, phase.startDate, phase.endDate])).toStrictEqual([
      ["gaps", "2026-09-30", "2026-10-03"],
      ["practice", "2026-10-04", "2026-10-05"],
      ["finalStretch", "2026-10-06", "2026-10-06"],
    ]);

    expect(datesOf({ items: plan.items, kind: "mock" })).toStrictEqual(["2026-10-06"]);
    expect(datesOf({ items: plan.items, kind: "boss" })).toStrictEqual([]);
    expect(datesOf({ items: plan.items, kind: "checkpoint" })).toStrictEqual([]);
    expect(lessonDates(plan.items).has("2026-10-06")).toBe(false);
    expect(plan.droppedSkillIds).toStrictEqual([]);
  });

  it("tomorrow on a short day: the whole day goes to the gaps, without a mock", () => {
    const plan = buildPlan({
      ...classTest({ days: 1 }),
      goal: { dailyMinutes: 30, kind: "exam", targetDate: addDays(TODAY, 1) },
    });

    expect(datesOf({ items: plan.items, kind: "mock" })).toStrictEqual([]);
    expect(plan.items.filter((item) => item.kind === "lesson").length).toBeGreaterThan(0);
  });

  it("tomorrow: one day for the gaps, closed by the short mock", () => {
    const plan = buildPlan(classTest({ days: 1 }));
    const lessons = plan.items.filter((item) => item.kind === "lesson");

    expect(plan.phases.map((phase) => phase.kind)).toStrictEqual(["gaps"]);
    expect(lessons.length).toBeGreaterThan(0);
    expect(lessons.every((item) => item.skillId !== "glycolysis")).toBe(true);
    expect(lessons[0]?.skillId).toBe("enzymes");
    expect(datesOf({ items: plan.items, kind: "mock" })).toStrictEqual(["2026-09-30"]);
    expect(datesOf({ items: plan.items, kind: "review" })).toStrictEqual([]);
    expect(plan.items.at(-1)?.kind).toBe("mock");
  });
});

describe("a public exam days away", () => {
  it("shares the days but keeps the light review the day before, without a mock", () => {
    const plan = buildPlan(classTest({ days: 3, shortMockMinutes: null }));

    expect(plan.phases.map((phase) => phase.kind)).toStrictEqual([
      "gaps",
      "practice",
      "finalStretch",
    ]);

    expect(datesOf({ items: plan.items, kind: "mock" })).toStrictEqual([]);
    expect(datesOf({ items: plan.items, kind: "boss" })).toStrictEqual([]);
    expect(plan.items.find((item) => item.kind === "review")?.minutes).toBe(15);
  });
});

describe("the minutes of a short plan's day before", () => {
  const calendar = {
    dailyMinutes: DAILY_MINUTES,
    firstDay: null,
    lightWeeks: [],
    weekdayMinutes: null,
  };

  function dayBefore({
    days,
    shortMockMinutes,
  }: {
    days: number;
    shortMockMinutes: number | null;
  }) {
    const targetDate = addDays(TODAY, days);

    return getPlannedMinutes({
      calendar,
      date: addDays(targetDate, -1),
      exam: { planStart: TODAY, shortMockMinutes },
      targetDate,
    });
  }

  it("gives a class test's mock day, and a test tomorrow, the learner's time", () => {
    expect(dayBefore({ days: 3, shortMockMinutes: SHORT_MOCK_MINUTES })).toBe(DAILY_MINUTES);
    expect(dayBefore({ days: 1, shortMockMinutes: null })).toBe(DAILY_MINUTES);
  });

  it("keeps it light for a public exam and for plans longer than a week", () => {
    expect(dayBefore({ days: 3, shortMockMinutes: null })).toBe(15);
    expect(dayBefore({ days: 30, shortMockMinutes: SHORT_MOCK_MINUTES })).toBe(15);
  });
});
