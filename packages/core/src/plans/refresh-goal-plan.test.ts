import { prisma } from "@zoonk/db";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { loadGoalPlan } from "../learner/_utils/goal-skill-graph";
import { markPlanItemsTestedOut, markSkillsKnown } from "../learner/_utils/known-skills";
import { getRequestProgressDateContext } from "../progress/get-request-date-context";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { createGoalPlan } from "./create-goal-plan";
import { decidePlanChange } from "./decide-plan-change";
import { getGoalPlan } from "./get-goal-plan";
import { refreshGoalPlan } from "./refresh-goal-plan";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("../progress/get-request-date-context", () => ({ getRequestProgressDateContext: vi.fn() }));

/**
 * A Monday in 2020, before the learning events other tests write: estimates read everyone's recent
 * pace, and this keeps it out of the dates these tests expect.
 */
const MONDAY = new Date("2020-09-28T12:00:00Z");
const THURSDAY = new Date("2020-10-01T12:00:00Z");

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

  it("gives the same coverage, time for everything and end date before and after its stand-ins are outlined", async () => {
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
    expect(before.feasibility?.recommendedMinutes).toBeGreaterThan(12);

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

    // The plan now holds the outlined lessons, and the numbers the learner saw stay.
    expect(planned.some((item) => item.lessonId !== null)).toBe(true);
    await expect(readNumbers(goal.id)).resolves.toStrictEqual(before);
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

  it("counts a skip as the plan's own rows, and its undo forgets what it only assumed", async () => {
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

    // The stand-in is one row on the plan, as in the result that lists these ids.
    expect(ids).toHaveLength(3);

    const change = await prisma.planChange.findFirstOrThrow({
      where: { kind: "testedOut", planId: plan.id },
    });

    await expect(
      decidePlanChange({ changeId: change.id, goalId: goal.id, input: { status: "undone" } }),
    ).resolves.toMatchObject({ change: { lessonsSkipped: 3, status: "undone" } });

    const known = await prisma.learnerSkill.findMany({ where: { userId: user.id } });

    expect(known.find((row) => row.skillId === assumed?.id)).toMatchObject({
      reps: 0,
      state: "new",
    });

    expect(known.find((row) => row.skillId === answered?.id)?.reps).toBe(1);
  });
});
