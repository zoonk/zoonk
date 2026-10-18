import { describe, expect, it } from "vitest";
import { type PlanOperation } from "../plan-contract";
import { type BuildPlanInput, buildPlan } from "./build-plan";
import { fromIsoDate, toIsoDate } from "./plan-calendar";
import { type PlannedItem } from "./plan-items";
import { applyPlanOperations } from "./plan-operations";
import { toExamWindows } from "./plan-phases";
import { type PlanGraph, parsePlanSettings } from "./plan-state";
import { withBuiltSettings } from "./run-outcome";

/** A Saturday: the plan is made, and its first lesson studied. */
const START = fromIsoDate("2026-10-10");

/** The Monday the learner asks for less Linguagens. */
const CHANGE_DAY = fromIsoDate("2026-10-12");

const TARGET = "2026-11-16";

/** An ENEM-like exam: four areas of two phases, each a lesson longer and weightier than the last. */
const graph: PlanGraph = {
  phases: [
    { milestone: null, name: "Base" },
    { milestone: null, name: "Aprofundamento" },
  ],
  skills: ["Natureza", "Humanas", "Matemática", "Linguagens"].flatMap((area, index) =>
    [0, 1].map((phase) => ({
      area,
      lessons: 4 + index,
      name: `${area} ${phase}`,
      phase,
      skillId: `${area}-${phase}`,
      weight: 2 + index,
    })),
  ),
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

/**
 * At 25 minutes a day, a half-day 180-minute mock is funded by every day before it, so each of
 * those days keeps time for about one lesson.
 */
const input: BuildPlanInput = {
  fullMockMinutes: 360,
  goal: { dailyMinutes: 25, kind: "exam", targetDate: fromIsoDate(TARGET) },
  graph,
  items: [],
  lessons,
  mockClocks: [{ day: 1, fullMinutes: 360, minutes: 180 }],
  mockMinutes: 180,
  mode: "forced",
  paceFactor: 1,
  prerequisites: new Map(),
  readiness: new Map(),
  settings: parsePlanSettings({ pace: { factor: 1, source: "typical" }, startDate: "2026-10-10" }),
  today: START,
};

function dateOf(item: Pick<PlannedItem, "scheduledFor">): string {
  return item.scheduledFor ? toIsoDate(item.scheduledFor) : "";
}

/** The plan made on the first day, saved with that day's lesson studied, and its first mock. */
function makeShownPlan() {
  const built = buildPlan(input);

  const items = built.items.map((item, position) => ({
    ...item,
    id: `item-${position}`,
    position,
    ...(dateOf(item) === "2026-10-10" && item.kind === "lesson"
      ? { completedAt: START, status: "done" as const }
      : {}),
  }));

  const mock = built.mockFunding.find((entry) => !entry.fullLength);

  if (!mock) {
    throw new Error("Expected a funded half-day mock");
  }

  return { built, items, mock };
}

/** Less of an area, asked on the change day, as a learner's change plans it. */
function reduce({ area, shown }: { area: string; shown: ReturnType<typeof makeShownPlan> }) {
  const settings = withBuiltSettings({ built: shown.built, settings: input.settings });
  const operations: PlanOperation[] = [{ areas: [area], kind: "reduceAreas" }];

  const applied = applyPlanOperations({
    goalKind: "exam",
    operations,
    state: { goal: { dailyMinutes: 25, targetDate: TARGET }, graph, settings },
    today: CHANGE_DAY,
  });

  if (!("state" in applied)) {
    throw new Error("The change doesn't apply.");
  }

  return buildPlan({
    ...input,
    bringBackSetAside: true,
    carryOver: { lessonIds: [], todayExceptAreas: [area] },
    examWindows: toExamWindows(shown.built.phases),
    finishedOn: new Map(
      shown.items.flatMap((item) => (item.status === "done" ? [[item.id, START] as const] : [])),
    ),
    items: shown.items,
    settings: applied.state.settings,
    today: CHANGE_DAY,
  });
}

/** The lessons dated from the change day through the mock: the days the learner was shown. */
function listShownDays({ items, mockDate }: { items: readonly PlannedItem[]; mockDate: string }) {
  const lessonDays = items.filter(
    (item) =>
      item.kind === "lesson" &&
      item.status === "todo" &&
      dateOf(item) >= toIsoDate(CHANGE_DAY) &&
      dateOf(item) <= mockDate,
  );

  return {
    busiest: Math.max(0, ...[...Map.groupBy(lessonDays, dateOf).values()].map((day) => day.length)),
    lessonIds: lessonDays
      .flatMap((item) => (item.lessonId ? [item.lessonId] : []))
      .toSorted((first, second) => first.localeCompare(second)),
  };
}

function getChallengeDay(items: readonly PlannedItem[]): string {
  const boss = items.find((item) => item.kind === "boss" && item.phase === 0);

  if (!boss) {
    throw new Error("Expected phase 0's challenge");
  }

  return dateOf(boss);
}

/** The next lesson of the chapter the learner studied on the first day, as the plan showed it. */
function findShownNext(items: readonly PlannedItem[]) {
  const studied = items.find((item) => item.status === "done");

  return items.find(
    (item) =>
      item.kind === "lesson" && item.status === "todo" && item.chapterId === studied?.chapterId,
  );
}

describe("a learner's change keeps the teaching the learner was shown", () => {
  /**
   * Less Linguagens leaves the other areas' phase-0 lessons on the days before the mock, so phase
   * 0's challenge stays after them and the mock stays on its funded day. The days before the mock
   * keep the lessons they showed: one may take another's day, but none comes from a later day and
   * no day crowds, as a mock moved later would allow by freeing their funded time. Each lesson
   * keeping its exact day is replanning's own promise to keep this week, so it isn't asserted here.
   */
  it("keeps the challenge, the funded mock and the shown days' lessons when an area is reduced", () => {
    const shown = makeShownPlan();
    const after = reduce({ area: "Linguagens", shown });
    const before = listShownDays({ items: shown.items, mockDate: shown.mock.date });
    const next = findShownNext(shown.items);

    // The premise: phase 0's challenge comes after the mock its days fund, a lesson a day before it.
    expect(fromIsoDate(getChallengeDay(shown.items)).getTime()).toBeGreaterThan(
      fromIsoDate(shown.mock.date).getTime(),
    );

    expect(before.lessonIds.length).toBeGreaterThan(1);
    expect(before.busiest).toBe(1);
    expect(next && dateOf(next) >= toIsoDate(CHANGE_DAY)).toBe(true);

    expect(getChallengeDay(after.items)).toBe(getChallengeDay(shown.items));
    expect(after.mocks.relocations).toStrictEqual([]);

    expect(after.mockFunding.find((entry) => !entry.fullLength)).toMatchObject({
      date: shown.mock.date,
      day: shown.mock.day,
      minutes: 180,
    });

    const kept = listShownDays({ items: after.items, mockDate: shown.mock.date });
    expect(kept.lessonIds).toStrictEqual(before.lessonIds);
    expect(kept.busiest).toBeLessThanOrEqual(before.busiest);

    const promised = after.items.find((item) => item.lessonId === next?.lessonId);
    expect(promised && next && dateOf(promised) <= dateOf(next)).toBe(true);
  });
});
