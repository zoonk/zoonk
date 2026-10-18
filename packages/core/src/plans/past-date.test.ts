import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getGoalPreparation } from "../preparation/get-goal-preparation";
import { getPlanTabView } from "../view-models/plan/get-plan-view";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { changeGoalPlan } from "./change-goal-plan";
import { createGoalPlan } from "./create-goal-plan";
import { findPlanTimeToCover } from "./get-time-advice";
import { type PlanChangeInput } from "./plan-contract";
import { previewPlanChange } from "./preview-plan-change";
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

/** What a change would do, as the learner's Preview reads it; nothing is saved. */
async function preview(goalId: string, operations: PlanChangeInput["operations"]) {
  const result = await previewPlanChange({ goalId, input: { operations, timeZone: "UTC" } });
  return result.status === "ready" ? result.preview : null;
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

  it("keeps going past its own date: asked, it finds the date the learner's time covers what's left by", async () => {
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

    // Reading the plan searches no date: the learner's Preview asks for it.
    expect(view).not.toHaveProperty("pastDateOffer");

    const found = await findPlanTimeToCover({ goalId: goal.id, input: {} });
    const targetDate = found.status === "ready" ? found.time.fittingDate : null;

    // The lessons the plan set aside are left, so the date isn't tomorrow: it's the day his
    // written lessons fit by, on the one measure the plan shows once the date moves.
    expect(targetDate).toBe("2020-11-04");

    const operations: PlanChangeInput["operations"] = [{ kind: "setTargetDate", targetDate }];
    const previewed = await preview(goal.id, operations);
    const effect = previewed?.effect;

    expect(effect?.lessonsAdded).toBe(lessons);
    expect(effect?.endDateAfter && effect.endDateAfter < (targetDate ?? "")).toBe(true);

    const preparation = await getGoalPreparation(goal.id);

    expect(preparation.status === "ready" && preparation.preparation.status).toStrictEqual({
      kind: "pastDate",
      lessons,
    });

    const applied = await changeGoalPlan({
      goalId: goal.id,
      input: { operations, timeZone: "UTC" },
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

  it("doesn't say it covers everything while lessons it set aside are left", async () => {
    const { goal, plan } = await pastDateGoal("learn");

    await refreshGoalPlan({ goalId: goal.id });

    // Lucas moves his date to tomorrow: his time lays out one lesson by then, the rest stays aside.
    const applied = await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ kind: "setTargetDate", targetDate: "2020-10-21" }], timeZone: "UTC" },
    });

    expect(applied.status).toBe("applied");

    const setAside = await prisma.planItem.count({
      where: { kind: "lesson", planId: plan.id, status: "skipped" },
    });

    expect(setAside).toBeGreaterThan(0);

    const view = await readPlan();

    expect(view?.feasibility?.fits).toBe(false);
    expect(view?.feasibility?.coveredShare).toBeLessThan(1);
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

    // An exam's date searches nothing: its plan going on after the exam is previewed when asked.
    const operations: PlanChangeInput["operations"] = [{ fullCourse: true, kind: "setFullCourse" }];

    // Everything left comes back, and what the exam's time never fitted with it.
    const previewed = await preview(goal.id, operations);
    expect(previewed?.effect?.lessonsAdded).toBeGreaterThanOrEqual(lessons);

    // The time it finds names no date: an exam's date is the exam's.
    await expect(findPlanTimeToCover({ goalId: goal.id, input: {} })).resolves.toMatchObject({
      status: "ready",
      time: { fittingDate: null },
    });

    const applied = await changeGoalPlan({
      goalId: goal.id,
      input: { operations, timeZone: "UTC" },
    });

    expect(applied.status).toBe("applied");
    await expect(readPlan()).resolves.not.toMatchObject({ status: { kind: "pastDate" } });
  });

  it("is finished when every lesson was studied by the date", async () => {
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
  });
});
