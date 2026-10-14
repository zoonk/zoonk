import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getGoalPreparation } from "../preparation/get-goal-preparation";
import { getPlanTabView } from "../view-models/plan/get-plan-view";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { changeGoalPlan } from "./change-goal-plan";
import { createGoalPlan } from "./create-goal-plan";
import { refreshGoalPlan } from "./refresh-goal-plan";

/** A Monday in 2020, before the learning events other tests write. */
const START = new Date("2020-09-28T12:00:00Z");

/** The goal's date, three weeks later. */
const DATE = new Date("2020-10-19T00:00:00Z");

/** The day after it: the new day's settling sets aside what the date left. */
const DAY_AFTER = new Date("2020-10-20T12:00:00Z");

/** The plan's learn items still to study: to do, or set aside. */
async function readLeftLessons(planId: string) {
  return prisma.planItem.findMany({
    where: { kind: { in: ["chapter", "lesson"] }, planId, status: { in: ["skipped", "todo"] } },
  });
}

async function readPlan() {
  const result = await getPlanTabView();
  return result.status === "ready" ? result.view.plan : null;
}

/**
 * A learner who studied one lesson of their plan and then stopped: the date came with the rest of
 * it left, and the day after, the new day's settling set it aside.
 */
async function pastDateGoal(kind: "exam" | "learn", dailyMinutes = 5) {
  const user = await userFixture();

  const library = await planLibraryFixture({
    skills: [
      { area: "Atoms", lessons: 6 },
      { area: "Light", builds: 0, lessons: 6 },
    ],
  });

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes,
    details: { placementDeclined: true },
    kind,
    settings: { startDate: "2020-09-28" },
    targetDate: DATE,
    timezone: "UTC",
    userId: user.id,
  });

  // Ana prepares on Plus: a free exam plan past its first week has no pace to keep.
  await prisma.subscription.create({
    data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });

  const plannedLessons = await prisma.planItem.count({
    where: { kind: "lesson", planId: plan.id, status: "todo" },
  });

  await learningOnce(plan.id);
  mockSession(user.id);

  vi.setSystemTime(DAY_AFTER);

  return { goal, plan, plannedLessons };
}

/** The learner studied the plan's first lesson. */
async function learningOnce(planId: string) {
  const first = await prisma.planItem.findFirstOrThrow({
    orderBy: { position: "asc" },
    where: { kind: "lesson", planId },
  });

  await prisma.planItem.update({ data: { status: "done" }, where: { id: first.id } });
}

/*
 * Lucas set himself a date and fell behind. The day after it his plan read "Ended" and "Your plan
 * ended · 13 lessons were left out", and offered the course's next level over the lessons he never
 * studied. The owner: plans don't end; offer a way to adjust them automatically.
 */
describe("a plan whose date came with lessons left", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(START);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps going past its own date: it offers the date the learner's time covers what's left by", async () => {
    const { goal, plan } = await pastDateGoal("learn");
    const { length: lessons } = await readLeftLessons(plan.id);

    expect(lessons).toBeGreaterThan(0);

    // Before the new day's settling the lessons are still to do; after it, set aside. Both read
    // the same: the date came with them left.
    await expect(readPlan()).resolves.toMatchObject({ status: { kind: "pastDate", lessons } });

    await refreshGoalPlan({ goalId: goal.id });

    const left = await readLeftLessons(plan.id);
    expect(left.every((item) => item.status === "skipped")).toBe(true);

    const view = await readPlan();

    expect(view?.status).toStrictEqual({ kind: "pastDate", lessons });
    expect(view?.end).toBeNull();

    const offer = view?.pastDateOffer;
    const [operation] = offer?.operations ?? [];

    expect(operation).toMatchObject({ kind: "setTargetDate", targetDate: expect.any(String) });

    const targetDate = operation?.kind === "setTargetDate" ? operation.targetDate : null;

    expect(targetDate && targetDate > "2020-10-20").toBe(true);
    expect(offer?.effect.lessonsAdded).toBe(lessons);
    expect(offer?.effect.endDateAfter && offer.effect.endDateAfter < (targetDate ?? "")).toBe(true);

    const preparation = await getGoalPreparation(goal.id);

    expect(preparation.status === "ready" && preparation.preparation.status).toStrictEqual({
      kind: "pastDate",
      lessons,
    });

    const applied = await changeGoalPlan({
      goalId: goal.id,
      input: { operations: offer?.operations ?? [], timeZone: "UTC" },
    });

    expect(applied.status).toBe("applied");

    const after = await readLeftLessons(plan.id);

    expect(after).toHaveLength(lessons);
    expect(after.every((item) => item.status === "todo")).toBe(true);

    // A plan made again to fit them is no backlog: the settling set them aside, it didn't carry
    // them. Lucas read "Behind · 13 lessons to catch up" right after moving his date.
    const moved = await readPlan();

    expect(moved?.status?.kind).not.toBe("pastDate");
    expect(moved?.status?.kind).not.toBe("behind");
  });

  it("keeps an exam's date, which is the exam's: its plan goes on after it", async () => {
    // Whole milestones and banked mocks leave only one lesson at 5 minutes; this learner left work.
    const { goal, plan, plannedLessons } = await pastDateGoal("exam", 6);
    expect(plannedLessons).toBeGreaterThan(1);

    await refreshGoalPlan({ goalId: goal.id });

    const { length: lessons } = await readLeftLessons(plan.id);
    const view = await readPlan();

    expect(lessons).toBeGreaterThan(0);
    expect(view?.status).toStrictEqual({ kind: "pastDate", lessons });

    expect(view?.pastDateOffer?.operations).toStrictEqual([
      { fullCourse: true, kind: "setFullCourse" },
    ]);

    // Everything left comes back, and what the exam's time never fitted with it.
    expect(view?.pastDateOffer?.effect.lessonsAdded).toBeGreaterThanOrEqual(lessons);

    const applied = await changeGoalPlan({
      goalId: goal.id,
      input: { operations: view?.pastDateOffer?.operations ?? [], timeZone: "UTC" },
    });

    expect(applied.status).toBe("applied");
    await expect(readPlan()).resolves.not.toMatchObject({ status: { kind: "pastDate" } });
  });

  it("is finished, with nothing to offer, when every lesson was studied by the date", async () => {
    const { goal, plan } = await pastDateGoal("learn");

    // Every lesson studied and the plan's challenge won (see `finished-plan.test.ts`).
    await prisma.planItem.updateMany({
      data: { status: "done" },
      where: { kind: { in: ["boss", "chapter", "lesson"] }, planId: plan.id },
    });

    await refreshGoalPlan({ goalId: goal.id });

    const view = await readPlan();

    expect(view?.status).toStrictEqual({ kind: "finished" });
    expect(view?.end).toStrictEqual({ kind: "finished" });
    expect(view?.pastDateOffer).toBeNull();
  });
});
