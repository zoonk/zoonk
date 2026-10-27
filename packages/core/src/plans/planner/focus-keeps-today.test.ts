import { describe, expect, it } from "vitest";
import { checkSteeringKeepsToday } from "../_test-utils/rules/steering-rules";
import { checkChapterInProgressKept } from "../_test-utils/rules/work-rules";
import { type PlanOperation } from "../plan-contract";
import { type BuildPlanInput, buildPlan } from "./build-plan";
import { toIsoDate } from "./plan-calendar";
import { type PlannedItem } from "./plan-items";
import { applyPlanOperations } from "./plan-operations";
import { type PlanGraph, parsePlanSettings } from "./plan-state";

/** A Monday. */
const TODAY = new Date("2026-10-12T00:00:00Z");
const DAY_MS = 86_400_000;

/** An ENEM-like exam: three subjects of two phases and the essay. */
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

/** The plan's items as saved, with their ids and places, as a change reads them. */
function toSaved(items: readonly PlannedItem[]) {
  return items.map((item, position) => ({ ...item, id: `item-${position}`, position }));
}

/** A steering change made while today's session is shown, as the rule checks read it. */
function steer({
  minutes,
  operations,
  unwritten = [],
}: {
  minutes: number;
  operations: PlanOperation[];
  /** Skills whose lessons the Library hasn't written yet: the plan holds a stand-in for each. */
  unwritten?: string[];
}) {
  const targetDate = new Date(TODAY.getTime() + 35 * DAY_MS);
  const settings = parsePlanSettings({ startDate: toIsoDate(TODAY) });

  const input: BuildPlanInput = {
    goal: { dailyMinutes: minutes, kind: "exam", targetDate },
    graph,
    items: [],
    lessons: lessons.filter((lesson) => !lesson.skillIds.some((id) => unwritten.includes(id))),
    mockMinutes: 180,
    mode: "forced",
    paceFactor: 1,
    prerequisites: new Map([["Redação-1", ["Redação-0"]]]),
    readiness: new Map(),
    settings,
    today: TODAY,
  };

  const shown = toSaved(buildPlan(input).items);

  const applied = applyPlanOperations({
    goalKind: "exam",
    operations,
    state: { goal: { dailyMinutes: minutes, targetDate: toIsoDate(targetDate) }, graph, settings },
    today: TODAY,
  });

  if (!("state" in applied)) {
    throw new Error("The change doesn't apply.");
  }

  const { state } = applied;

  const changed = {
    ...input,
    carryOver: {
      lessonIds: [],
      todayExceptAreas: operations.flatMap((operation) =>
        operation.kind === "reduceAreas" ? operation.areas : [],
      ),
    },
    items: shown,
    settings: state.settings,
  };

  const plan = { goal: input.goal, graph, settings: state.settings };

  return checkSteeringKeepsToday({
    after: { ...plan, items: buildPlan(changed).items, phases: [] },
    before: { ...plan, items: shown, phases: [] },
    event: { kind: "learnerChange", operations },
    today: TODAY,
    todayShown: true,
  });
}

describe("a change of focus while today is shown", () => {
  // Less natural sciences freed today's time, and human sciences, which the learner didn't name, took it.
  it.each([
    [15, [{ areas: ["Natureza"], kind: "reduceAreas" }]],
    [15, [{ areas: ["Redação"], kind: "reduceAreas" }]],
    [30, [{ areas: ["Natureza"], kind: "reduceAreas" }]],
    [
      15,
      [
        { areas: ["Humanas"], kind: "focusAreas" },
        { areas: ["Natureza"], kind: "reduceAreas" },
      ],
    ],
    [30, [{ areas: ["Matemática"], kind: "focusAreas" }]],
  ] satisfies [number, PlanOperation[]][])(
    "keeps today's lessons and brings in only focused ones, at %i minutes",
    (minutes, operations) => {
      expect(steer({ minutes, operations })).toStrictEqual([]);
    },
  );

  // Human sciences aren't written yet: its stand-in on today's list stays there, as the learner saw it.
  it("keeps a stand-in due today in its place", () => {
    expect(
      steer({
        minutes: 20,
        operations: [{ areas: ["Matemática"], kind: "focusAreas" }],
        unwritten: ["Humanas-0", "Natureza-0"],
      }),
    ).toStrictEqual([]);
  });
});

/**
 * "Less essay" the day after the learner started an essay chapter: yesterday's lessons are done,
 * and today has the chapter's next lesson. The rule checks read the change as R10 does.
 */
function reduceMidChapter() {
  const yesterday = new Date(TODAY.getTime() - DAY_MS);
  const targetDate = new Date(TODAY.getTime() + 35 * DAY_MS);
  const settings = parsePlanSettings({ startDate: toIsoDate(yesterday) });
  const operations: PlanOperation[] = [{ areas: ["Redação"], kind: "reduceAreas" }];

  const input: BuildPlanInput = {
    goal: { dailyMinutes: 45, kind: "exam", targetDate },
    graph,
    items: [],
    lessons,
    mockMinutes: 180,
    mode: "forced",
    paceFactor: 1,
    prerequisites: new Map([["Redação-1", ["Redação-0"]]]),
    readiness: new Map(),
    settings,
    today: yesterday,
  };

  const shown = toSaved(buildPlan(input).items).map((item) =>
    item.scheduledFor?.getTime() === yesterday.getTime()
      ? { ...item, completedAt: yesterday, status: "done" as const }
      : item,
  );

  const applied = applyPlanOperations({
    goalKind: "exam",
    operations,
    state: { goal: { dailyMinutes: 45, targetDate: toIsoDate(targetDate) }, graph, settings },
    today: TODAY,
  });

  if (!("state" in applied)) {
    throw new Error("The change doesn't apply.");
  }

  const changed = {
    ...input,
    carryOver: { lessonIds: [], todayExceptAreas: ["Redação"] },
    items: shown,
    settings: applied.state.settings,
    today: TODAY,
  };

  const plan = { goal: input.goal, graph, settings: applied.state.settings };

  return {
    context: {
      after: { ...plan, items: buildPlan(changed).items, phases: [] },
      before: { ...plan, items: shown, phases: [] },
      changes: [],
      event: { kind: "learnerChange" as const, operations },
      today: TODAY,
      todayShown: true,
    },
    shown,
  };
}

describe("less of the subject of the chapter in progress while today is shown", () => {
  // ENEM 2083: "less essay" the day after an essay lesson moved the chapter's next lesson from
  // today to two days later, with physics before it (R10). The chapter finishes first.
  it("keeps the chapter's next lesson today", () => {
    const { context, shown } = reduceMidChapter();

    expect(
      shown.some(
        (item) =>
          item.chapterId === "chapter-Redação-0" &&
          item.status === "todo" &&
          item.scheduledFor?.getTime() === TODAY.getTime(),
      ),
    ).toBe(true);

    expect(checkChapterInProgressKept(context)).toStrictEqual([]);
  });
});
