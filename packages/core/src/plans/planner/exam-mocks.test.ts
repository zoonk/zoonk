import { describe, expect, it } from "vitest";
import { checkMocksInEveryPhase } from "../_test-utils/rules/day-rules";
import { type BuildPlanInput, buildPlan } from "./build-plan";
import { toIsoDate } from "./plan-calendar";
import { type PlanGraph, parsePlanSettings } from "./plan-state";

const TODAY = new Date("2026-10-12T00:00:00Z");
const DAY_MS = 86_400_000;

function day(offset: number): Date {
  return new Date(TODAY.getTime() + offset * DAY_MS);
}

const AREAS = ["Natureza", "Humanas", "Matemática"];

const graph: PlanGraph = {
  phases: [
    { milestone: null, name: "Base" },
    { milestone: null, name: "Aprofundamento" },
  ],
  skills: AREAS.flatMap((area) =>
    [0, 1].map((phase) => ({
      area,
      lessons: 12,
      name: `${area} ${phase}`,
      phase,
      skillId: `${area}-${phase}`,
      weight: 3,
    })),
  ),
};

const lessons = graph.skills.flatMap((skill) =>
  Array.from({ length: 12 }, (_, index) => ({
    chapterId: `chapter-${skill.skillId}`,
    lessonId: `${skill.skillId}-${index}`,
    minutes: 5,
    skillIds: [skill.skillId],
    title: `${skill.name} ${index}`,
  })),
);

function buildExamPlan({ daysAway, minutes = 60 }: { daysAway: number; minutes?: number }) {
  const input: BuildPlanInput = {
    goal: { dailyMinutes: minutes, kind: "exam", targetDate: day(daysAway) },
    graph,
    items: [],
    lessons,
    mockMinutes: 180,
    mode: "forced",
    paceFactor: 1,
    prerequisites: new Map(),
    readiness: new Map(),
    settings: parsePlanSettings({ startDate: toIsoDate(TODAY) }),
    today: TODAY,
  };

  return { built: buildPlan(input), input };
}

function checkMocks({ built, input }: ReturnType<typeof buildExamPlan>) {
  return checkMocksInEveryPhase({
    after: {
      goal: input.goal,
      graph,
      items: built.items,
      phases: built.phases,
      settings: input.settings,
    },
    before: null,
    event: { kind: "planCreated" },
    today: TODAY,
  });
}

function examPlan({ daysAway, minutes = 60 }: { daysAway: number; minutes?: number }) {
  return checkMocks(buildExamPlan({ daysAway, minutes }));
}

describe("an exam plan's mocks", () => {
  it.each([4, 6, 8, 9, 10, 12])("has one before the exam %i days away", (daysAway) => {
    expect(examPlan({ daysAway })).toStrictEqual([]);
  });

  it("leaves out a mock the days before it can't fund, 3 days away", () => {
    const { built } = buildExamPlan({ daysAway: 3 });
    const planned = built.items.reduce((total, item) => total + item.minutes, 0);

    expect(built.items.filter((item) => item.kind === "mock")).toStrictEqual([]);
    expect(built.mockFunding).toStrictEqual([]);
    expect(planned).toBeLessThanOrEqual(60 * 2 + 15 + 0.1);
  });

  it.each([21, 35, 60, 120])(
    "has one in every phase of two weeks or more, %i days away",
    (daysAway) => {
      expect(examPlan({ daysAway })).toStrictEqual([]);
    },
  );
});

function countMocks({ built }: ReturnType<typeof buildExamPlan>) {
  return built.items.filter((item) => item.kind === "mock").length;
}

describe("an exam plan's mocks in the learner's time", () => {
  it("spaces mocks longer than the learner's day, a study day's time a week, and keeps one in every phase", () => {
    const plan = buildExamPlan({ daysAway: 120, minutes: 15 });
    const phases = plan.built.phases.filter((phase) => phase.startDate !== null).length;

    expect(countMocks(plan)).toBeLessThanOrEqual(2 + phases);
    expect(checkMocks(plan)).toStrictEqual([]);
  });

  it("keeps a mock a week when a study day holds it", () => {
    expect(countMocks(buildExamPlan({ daysAway: 120, minutes: 180 }))).toBeGreaterThanOrEqual(14);
  });
});
