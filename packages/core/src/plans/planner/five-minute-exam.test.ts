import { describe, expect, it } from "vitest";
import { checkDayOneHasSession, checkDayOneOpensWithGaps } from "../_test-utils/rules/day-rules";
import { checkWrittenTestsKept } from "../_test-utils/rules/keep-rules";
import { type RuleContext } from "../_test-utils/rules/rule-context";
import { type BuildPlanInput, buildPlan } from "./build-plan";
import { toIsoDate } from "./plan-calendar";
import { type PlanGraph, parsePlanSettings } from "./plan-state";

const TODAY = new Date("2026-10-12T00:00:00Z");
const DAY_MS = 86_400_000;

const graph: PlanGraph = {
  phases: [
    { milestone: null, name: "Base" },
    { milestone: null, name: "Aprofundamento" },
  ],
  skills: [
    ...["Natureza", "Humanas", "Matemática"].flatMap((area) =>
      [0, 1].map((phase) => ({
        area,
        lessons: 6,
        name: `${area} ${phase}`,
        phase,
        skillId: `${area}-${phase}`,
        weight: 3,
      })),
    ),
    ...[0, 1].map((phase) => ({
      area: "Redação",
      lessons: 4,
      name: `Redação ${phase}`,
      outcome: true,
      phase,
      skillId: `Redação-${phase}`,
      weight: 4,
    })),
  ],
};

const lessons = graph.skills.flatMap((skill) =>
  Array.from({ length: skill.lessons }, (_, index) => ({
    chapterId: `chapter-${skill.skillId}`,
    lessonId: `${skill.skillId}-${index}`,
    minutes: 4,
    skillIds: [skill.skillId],
    title: `${skill.name} ${index}`,
  })),
);

function newPlan({
  daysAway,
  from = 0,
  gaps = [],
  minutes,
}: {
  daysAway: number;
  from?: number;
  gaps?: string[];
  minutes: number;
}): RuleContext {
  const today = new Date(TODAY.getTime() + from * DAY_MS);

  const input: BuildPlanInput = {
    goal: {
      dailyMinutes: minutes,
      kind: "exam",
      targetDate: new Date(today.getTime() + daysAway * DAY_MS),
    },
    graph,
    items: [],
    lessons,
    missedSkillIds: new Set(gaps),
    mockMinutes: 180,
    mode: "forced",
    paceFactor: 1,
    prerequisites: new Map([["Redação-1", ["Redação-0"]]]),
    readiness: new Map(),
    settings: parsePlanSettings({ startDate: toIsoDate(today) }),
    today,
  };

  const built = buildPlan(input);

  return {
    after: {
      goal: input.goal,
      graph,
      items: built.items,
      phases: built.phases,
      settings: input.settings,
    },
    before: null,
    event: { kind: "planCreated" },
    learner: { gapAreas: gaps.map((skillId) => skillId.split("-")[0] ?? skillId), knownAreas: [] },
    today,
  };
}

describe("an exam plan at a few minutes a day", () => {
  it.each([5, 10])("keeps the Redação and has a first day at %i minutes", (minutes) => {
    const plan = newPlan({ daysAway: 35, minutes });

    expect([...checkWrittenTestsKept(plan), ...checkDayOneHasSession(plan)]).toStrictEqual([]);
  });

  it.each([
    [5, 2, 0],
    [5, 3, 0],
    [5, 8, 0],
    [6, 8, 0],
    [8, 8, 3],
    [10, 3, 0],
    [10, 8, 0],
    [20, 2, 0],
  ])(
    "keeps the Redação and has a first day at %i minutes, %i days away, from day %i",
    (minutes, daysAway, from) => {
      const plan = newPlan({ daysAway, from, gaps: ["Humanas-1"], minutes });

      expect([
        ...checkWrittenTestsKept(plan),
        ...checkDayOneHasSession(plan),
        ...checkDayOneOpensWithGaps(plan),
      ]).toStrictEqual([]);
    },
  );
});
