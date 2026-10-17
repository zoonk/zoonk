import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { loadGoalPlan } from "../learner/_utils/goal-skill-graph";
import { markPlanItemsTestedOut, markSkillsKnown } from "../learner/_utils/known-skills";
import { getRequestProgressDateContext } from "../progress/get-request-date-context";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { loadTodayPlanChange } from "./_utils/today-plan-change";
import { createGoalPlan } from "./create-goal-plan";
import { decidePlanChange } from "./decide-plan-change";
import { getGoalPlan } from "./get-goal-plan";
import { findPlanTimeToCover } from "./get-time-advice";
import { parsePlanGraph } from "./planner/plan-state";
import { refreshGoalPlan } from "./refresh-goal-plan";
import { getRecommendedTime } from "./time-advice-contract";

/**
 * A Monday in 2020, before the learning events other tests write: estimates read everyone's recent
 * pace, and this keeps it out of the dates these tests expect.
 */
const MONDAY = new Date("2020-09-28T12:00:00Z");
const THURSDAY = new Date("2020-10-01T12:00:00Z");
const FRIDAY = new Date("2020-10-02T12:00:00Z");

async function setup() {
  const user = await userFixture();
  const library = await planLibraryFixture({ skills: [{ lessons: 8 }, { lessons: 6 }] });

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 12,
    settings: { startDate: "2020-09-28" },
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });
  mockSession(user.id);

  return { goal, library, plan, user };
}

function todoDates(planId: string) {
  return prisma.planItem
    .findMany({ orderBy: { position: "asc" }, where: { planId, status: "todo" } })
    .then((items) => items.map((item) => item.scheduledFor?.toISOString().slice(0, 10)));
}

describe(refreshGoalPlan, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(MONDAY);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("writes nothing when nothing moved", async () => {
    const { goal, plan } = await setup();
    const before = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });

    await expect(refreshGoalPlan({ goalId: goal.id })).resolves.toStrictEqual({
      status: "unchanged",
    });

    const after = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    expect(after.version).toBe(before.version);
  });

  it("re-flows missed days from today instead of piling them up, and says so once", async () => {
    const { goal, plan } = await setup();
    vi.setSystemTime(THURSDAY);

    await expect(refreshGoalPlan({ goalId: goal.id })).resolves.toStrictEqual({
      status: "refreshed",
    });

    const dates = await todoDates(plan.id);
    expect(dates.every((date) => date !== undefined && date >= "2020-10-01")).toBe(true);
    expect(dates[0]).toBe("2020-10-01");

    const changes = await prisma.planChange.findMany({ where: { planId: plan.id } });
    expect(changes).toHaveLength(1);

    expect(changes[0]).toMatchObject({
      kind: "missedDays",
      payload: { days: 3, source: "system" },
      status: "applied",
    });

    await expect(refreshGoalPlan({ goalId: goal.id })).resolves.toStrictEqual({
      status: "unchanged",
    });
  });

  it("leaves paused goals and unbuilt plans alone", async () => {
    const { goal } = await setup();
    await prisma.goal.update({ data: { status: "paused" }, where: { id: goal.id } });

    await expect(refreshGoalPlan({ goalId: goal.id })).resolves.toStrictEqual({ status: "paused" });

    const user = await userFixture();
    const unbuilt = await unplannedGoalFixture({ userId: user.id });

    await expect(refreshGoalPlan({ goalId: unbuilt.goal.id })).resolves.toStrictEqual({
      status: "notReady",
    });
  });

  it("lays out a plan whose graph is ready but was never laid out when a day is built", async () => {
    const user = await userFixture();
    const library = await planLibraryFixture({ skills: [{ lessons: 3 }] });

    const { goal, plan } = await unplannedGoalFixture({
      dailyMinutes: 12,
      settings: { startDate: "2020-09-28" },
      userId: user.id,
    });

    await prisma.plan.update({ data: { graph: library.graph }, where: { id: plan.id } });

    await expect(refreshGoalPlan({ goalId: goal.id, settleOnly: true })).resolves.toStrictEqual({
      status: "refreshed",
    });

    const after = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });

    const lessons = await prisma.planItem.findMany({ where: { kind: "lesson", planId: plan.id } });

    expect(after.phases).not.toStrictEqual([]);
    expect(lessons.map((item) => item.scheduledFor !== null)).toStrictEqual([true, true, true]);

    await expect(
      prisma.planChange.count({ where: { kind: "estimateUpdated", planId: plan.id } }),
    ).resolves.toBe(0);
  });

  it("keeps the chapter an unstarted lesson teaches from when the refresh moves it", async () => {
    vi.setSystemTime(FRIDAY);
    const user = await userFixture();

    const [goal, chapter, skill] = await Promise.all([
      goalFixture({ timezone: "UTC", userId: user.id }),
      libraryChapterFixture({ title: "Fundamental principles" }),
      skillFixture({ name: "Apply the fundamental principles" }),
    ]);

    // A plan saved before this read: its pace and start not set yet, so the refresh writes it.
    const plan = await planFixture({
      goalId: goal.id,
      graph: {
        phases: [{ milestone: null, name: "Foundations" }],
        skills: [{ area: null, lessons: 2, name: skill.name, phase: 0, skillId: skill.id }],
      },
    });

    const item = await planItemFixture({
      chapterId: chapter.id,
      planId: plan.id,
      scheduledFor: new Date("2020-10-05"),
      skillId: skill.id,
    });

    await expect(refreshGoalPlan({ goalId: goal.id })).resolves.toStrictEqual({
      status: "refreshed",
    });

    await expect(
      prisma.planItem.findUniqueOrThrow({ where: { id: item.id } }),
    ).resolves.toMatchObject({ chapterId: chapter.id, status: "todo" });
  });
});

/** What the plan's screens show about its reach: its end and what the learner's time covers. */
async function readNumbers(goalId: string) {
  const result = await getGoalPlan(goalId);
  const plan = result.status === "ready" ? result.plan : null;

  return { estimate: plan?.estimate.endDate, feasibility: plan?.feasibility };
}

describe("a plan's numbers while the Library outlines it", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(MONDAY);

    vi.mocked(getRequestProgressDateContext).mockResolvedValue({
      currentDate: new Date("2020-09-28T00:00:00Z"),
      currentInstant: MONDAY,
      timeZone: "UTC",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("measures the plan it holds before and after its stand-ins are outlined", async () => {
    const user = await userFixture();

    // Two skills written, and one the Library hasn't outlined yet: a stand-in of 30 lessons.
    const library = await planLibraryFixture({
      skills: [{ lessons: 4 }, { lessons: 3 }, { lessons: 0, size: 30 }],
    });

    const { goal } = await unplannedGoalFixture({
      dailyMinutes: 12,
      settings: { startDate: "2020-09-28" },
      targetDate: new Date("2020-10-09T00:00:00Z"),
      userId: user.id,
    });

    await createGoalPlan({ goalId: goal.id, graph: library.graph });
    mockSession(user.id);

    const before = await readNumbers(goal.id);

    expect(before.feasibility).toMatchObject({ fits: false });
    expect(before.feasibility?.coveredShare).toBeGreaterThan(0);
    expect(before.feasibility?.coveredShare).toBeLessThan(1);

    // The time for everything is the learner's to ask for ("Find the time that covers everything").
    const findTime = () => findPlanTimeToCover({ goalId: goal.id, input: {} });
    const timeBefore = await findTime();
    const found = timeBefore.status === "ready" ? timeBefore.time : null;

    expect(found && getRecommendedTime(found)).toMatchObject({ kind: "inDepth" });
    expect(found?.recommendedMinutes).toBeGreaterThan(12);
    expect(found?.fittingDate).toMatch(/^\d{4}-\d{2}-\d{2}$/u);

    // The Library outlines the stand-in as 18 lessons of 5 minutes, not 30 of 3.
    const standIn = library.skills[2];
    const chapterId = library.chapters[0]?.id ?? "";

    await Promise.all(
      Array.from({ length: 18 }, async (_, index) => {
        const lesson = await libraryLessonFixture({
          estimatedMinutes: 5,
          homeChapterId: chapterId,
          title: `Outlined ${index} ${crypto.randomUUID()}`,
        });

        await Promise.all([
          chapterLessonFixture({ chapterId, lessonId: lesson.id, position: 500 + index }),
          lessonSkillFixture({ lessonId: lesson.id, skillId: standIn?.id ?? "" }),
        ]);
      }),
    );

    await refreshGoalPlan({ goalId: goal.id });

    const planned = await prisma.planItem.findMany({
      where: { plan: { goalId: goal.id }, skillId: standIn?.id, status: "todo" },
    });

    // The plan now holds the outlined lessons, and its numbers measure that plan: the share can
    // move as a stand-in's estimate becomes written lessons, and the plan still falls short.
    expect(planned.some((item) => item.lessonId !== null)).toBe(true);
    const after = await readNumbers(goal.id);

    expect(after.feasibility).toMatchObject({ fits: false });
    expect(after.feasibility?.coveredShare).toBeGreaterThan(0);
    expect(after.feasibility?.coveredShare).toBeLessThan(1);

    // The time for everything is found for the plan it holds now.
    const timeAfter = await findTime();
    const foundAfter = timeAfter.status === "ready" ? timeAfter.time : null;

    expect(foundAfter && getRecommendedTime(foundAfter)).toMatchObject({ kind: "inDepth" });
    expect(foundAfter?.recommendedMinutes).toBeGreaterThan(12);
  });
});

describe("test-outs on the plan", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(MONDAY);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("says what a test-out skipped, pulls the rest forward, and can bring the lessons back", async () => {
    const { goal, library, plan } = await setup();
    const datesBefore = await todoDates(plan.id);
    const endBefore = datesBefore.at(-1);
    const goalPlan = await loadGoalPlan(goal.id);

    const { changeId, planItemIds: ids } = await markPlanItemsTestedOut({
      goalId: goal.id,
      items: goalPlan.items,
      knownSkillIds: new Set([library.skills[0]?.id ?? ""]),
      testedOutAt: MONDAY,
      timeZone: "UTC",
    });

    expect(ids).toHaveLength(8);

    const change = await prisma.planChange.findFirstOrThrow({
      where: { kind: "testedOut", planId: plan.id },
    });

    // The skip returns its change, so the screen that skipped the lessons can undo it right there.
    expect(changeId).toBe(change.id);

    expect(change.payload).toMatchObject({ planItemIds: ids, source: "system" });

    const datesAfter = await todoDates(plan.id);
    const endAfter = datesAfter.at(-1);
    expect(endAfter && endBefore && endAfter < endBefore).toBe(true);

    const undone = await decidePlanChange({
      changeId: change.id,
      goalId: goal.id,
      input: { status: "undone" },
    });

    expect(undone).toMatchObject({
      change: { kind: "testedOut", lessonsSkipped: 8, status: "undone" },
    });

    const restored = await prisma.planItem.count({ where: { id: { in: ids }, status: "todo" } });
    expect(restored).toBe(8);
    await expect(todoDates(plan.id).then((dates) => dates.at(-1))).resolves.toBe(endBefore);
  });

  it("keeps the lessons outlined later for a skill a test-out settled out of the next re-plans", async () => {
    const { goal, library, plan } = await setup();
    const [known, other] = library.skills;
    const goalPlan = await loadGoalPlan(goal.id);

    await markPlanItemsTestedOut({
      goalId: goal.id,
      items: goalPlan.items,
      knownSkillIds: new Set([known?.id ?? ""]),
      testedOutAt: MONDAY,
      timeZone: "UTC",
    });

    // The Library outlines another chapter of each skill afterwards.
    const outlined = await Promise.all(
      [known, other].map(async (skill, index) => {
        const lesson = await libraryLessonFixture({
          estimatedMinutes: 3,
          homeChapterId: library.chapters[0]?.id ?? null,
          title: `Outlined later ${index} ${crypto.randomUUID()}`,
        });

        await Promise.all([
          chapterLessonFixture({
            chapterId: library.chapters[0]?.id ?? "",
            lessonId: lesson.id,
            position: 1000 + index,
          }),
          lessonSkillFixture({ lessonId: lesson.id, skillId: skill?.id ?? "" }),
        ]);

        return lesson;
      }),
    );

    vi.setSystemTime(THURSDAY);
    await refreshGoalPlan({ goalId: goal.id });

    const todo = await prisma.planItem.findMany({ where: { planId: plan.id, status: "todo" } });
    const todoLessonIds = todo.map((item) => item.lessonId);

    expect(todo.some((item) => item.skillId === known?.id)).toBe(false);
    expect(todoLessonIds).not.toContain(outlined[0]?.id);
    expect(todoLessonIds).toContain(outlined[1]?.id);
  });

  // Juliana's Today said "We skipped 49 lessons you already know" while her Plan's subjects
  // added up to 235: the change counted rows, a stand-in as one, and the Plan its lessons.
  it("counts a skip's lessons as the Journey does, and its undo forgets what it only assumed", async () => {
    const user = await userFixture();

    // The first skill's lessons aren't written yet: one stand-in plans six of them.
    const library = await planLibraryFixture({
      skills: [{ lessons: 0, size: 6 }, { lessons: 2 }, { lessons: 4 }],
    });

    const { goal, plan } = await unplannedGoalFixture({
      dailyMinutes: 12,
      settings: { startDate: "2020-09-28" },
      userId: user.id,
    });

    await createGoalPlan({ goalId: goal.id, graph: library.graph });
    mockSession(user.id);

    const [assumed, answered] = library.skills;
    const skillIds = [assumed?.id ?? "", answered?.id ?? ""];

    // Placement asked about the second skill and assumed the first from the answers around it.
    await attemptFixture({ answeredAt: MONDAY, skillId: answered?.id, userId: user.id });
    await markSkillsKnown({ knownAt: MONDAY, skillIds, timeZone: "UTC", userId: user.id });
    const goalPlan = await loadGoalPlan(goal.id);

    const { planItemIds: ids } = await markPlanItemsTestedOut({
      goalId: goal.id,
      items: goalPlan.items,
      knownSkillIds: new Set(skillIds),
      testedOutAt: MONDAY,
      timeZone: "UTC",
    });

    // The stand-in is one row on the plan, as in the result that lists these ids, and six lessons.
    expect(ids).toHaveLength(3);

    const [change, today] = await Promise.all([
      prisma.planChange.findFirstOrThrow({ where: { kind: "testedOut", planId: plan.id } }),
      loadTodayPlanChange({ goal, now: MONDAY }),
    ]);

    expect(today?.lessonsSkipped).toBe(8);

    await expect(
      decidePlanChange({ changeId: change.id, goalId: goal.id, input: { status: "undone" } }),
    ).resolves.toMatchObject({ change: { lessonsSkipped: 8, status: "undone" } });

    const known = await prisma.learnerSkill.findMany({ where: { userId: user.id } });

    expect(known.find((row) => row.skillId === assumed?.id)).toMatchObject({
      reps: 0,
      state: "new",
    });

    expect(known.find((row) => row.skillId === answered?.id)?.reps).toBe(1);
  });
});

describe("the lessons a plan counted for each skill", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(MONDAY);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // A challenge sizes a skill's core by them (`listCoreLessonItems`): a count older than the plan's
  // key let it ask a skill whose core grew, here from two lessons to three.
  it("follows the Library when it grows past what a plan short on time keeps", async () => {
    const user = await userFixture();
    const library = await planLibraryFixture({ skills: [{ lessons: 4 }, { lessons: 6 }] });

    const { goal, plan } = await unplannedGoalFixture({
      dailyMinutes: 6,
      settings: { startDate: "2020-09-28" },
      targetDate: new Date("2020-09-30T00:00:00Z"),
      userId: user.id,
    });

    await createGoalPlan({ goalId: goal.id, graph: library.graph });
    mockSession(user.id);

    const grown = library.skills[1];
    const chapterId = library.chapters[0]?.id ?? "";
    const before = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    const itemsBefore = await prisma.planItem.findMany({ where: { planId: plan.id } });

    const lesson = await libraryLessonFixture({
      estimatedMinutes: 3,
      homeChapterId: chapterId,
      title: `Lesson 2.7 ${crypto.randomUUID()}`,
    });

    await Promise.all([
      chapterLessonFixture({ chapterId, lessonId: lesson.id, position: 106 }),
      lessonSkillFixture({ lessonId: lesson.id, skillId: grown?.id ?? "" }),
    ]);

    await expect(refreshGoalPlan({ goalId: goal.id })).resolves.toStrictEqual({
      status: "unchanged",
    });

    const after = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    const itemsAfter = await prisma.planItem.findMany({ where: { planId: plan.id } });

    const counted = (graph: unknown) =>
      parsePlanGraph(graph).skills.find((skill) => skill.skillId === grown?.id)?.plannedLessons;

    // The plan keeps the same lessons and version; only the count follows the Library.
    expect(new Set(itemsAfter.map((item) => item.lessonId))).toStrictEqual(
      new Set(itemsBefore.map((item) => item.lessonId)),
    );

    expect(after.version).toBe(before.version);
    expect([counted(before.graph), counted(after.graph)]).toStrictEqual([6, 7]);
  });
});
