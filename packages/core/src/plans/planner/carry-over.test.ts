import { describe, expect, it } from "vitest";
import { checkSteeringKeepsToday } from "../_test-utils/rules/steering-rules";
import { type PlanOperation } from "../plan-contract";
import { type BuildPlanInput, buildPlan } from "./build-plan";
import { addDays, toIsoDate } from "./plan-calendar";
import { type PlannedItem } from "./plan-items";
import { applyPlanOperations } from "./plan-operations";
import { type PlanGraph, parsePlanSettings } from "./plan-state";

const TODAY = new Date("2026-10-12T00:00:00Z");

const graph: PlanGraph = {
  phases: [{ milestone: null, name: "Base" }],
  skills: ["Civil", "Penal", "Ética"].map((area) => ({
    area,
    lessons: 8,
    name: area,
    phase: 0,
    skillId: area,
    weight: 3,
  })),
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

function listTodayLessons(items: readonly PlannedItem[]): string[] {
  return items.flatMap((item) =>
    item.kind === "lesson" &&
    item.status === "todo" &&
    item.scheduledFor?.getTime() === TODAY.getTime()
      ? [item.lessonId ?? ""]
      : [],
  );
}

function reduceAtSlowerPace() {
  const targetDate = addDays(TODAY, 40);
  const settings = parsePlanSettings({ startDate: toIsoDate(TODAY) });
  const operations: PlanOperation[] = [{ areas: ["Ética"], kind: "reduceAreas" }];

  const input: BuildPlanInput = {
    goal: { dailyMinutes: 30, kind: "exam", targetDate },
    graph,
    items: [],
    lessons,
    mockMinutes: 180,
    mode: "forced",
    paceFactor: 1,
    prerequisites: new Map(),
    readiness: new Map(),
    settings,
    today: TODAY,
  };

  const shown = buildPlan(input).items.map((item, position) => ({
    ...item,
    id: `item-${position}`,
    position,
  }));

  const applied = applyPlanOperations({
    goalKind: "exam",
    operations,
    state: { goal: { dailyMinutes: 30, targetDate: toIsoDate(targetDate) }, graph, settings },
    today: TODAY,
  });

  if (!("state" in applied)) {
    throw new Error("The change doesn't apply.");
  }

  const after = buildPlan({
    ...input,
    carryOver: { lessonIds: [], todayExceptAreas: ["Ética"] },
    items: shown,
    paceFactor: 1.5,
    settings: applied.state.settings,
  }).items;

  const plan = { goal: input.goal, graph, settings: applied.state.settings };

  return {
    after,
    context: {
      after: { ...plan, items: after, phases: [] },
      before: { ...plan, items: shown, phases: [] },
      changes: [],
      event: { kind: "learnerChange" as const, operations },
      today: TODAY,
      todayShown: true,
    },
    shown,
  };
}

describe("a change of focus when today's time no longer holds today's lessons", () => {
  it("keeps every lesson of today the change doesn't reduce on today, in order", () => {
    const { after, context, shown } = reduceAtSlowerPace();
    const kept = listTodayLessons(shown).filter((lessonId) => !lessonId.startsWith("Ética"));

    const stayed = listTodayLessons(after).filter((lessonId) => kept.includes(lessonId));

    expect(kept.length).toBeGreaterThan(1);
    expect(stayed).toStrictEqual(kept);
    expect(checkSteeringKeepsToday(context)).toStrictEqual([]);
  });
});
