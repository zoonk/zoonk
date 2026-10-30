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

const DATE = new Date("2020-10-19T00:00:00Z");

const DAY_AFTER = new Date("2020-10-20T12:00:00Z");

async function readLeftLessons(planId: string) {
  return prisma.planItem.findMany({
    where: { kind: { in: ["chapter", "lesson"] }, planId, status: { in: ["skipped", "todo"] } },
  });
}

async function readPlan() {
  const result = await getPlanTabView();
  return result.status === "ready" ? result.view.plan : null;
}

async function preview(goalId: string, operations: PlanChangeInput["operations"]) {
  const result = await previewPlanChange({ goalId, input: { operations, timeZone: "UTC" } });
  return result.status === "ready" ? result.preview : null;
}

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

async function learningOnce(planId: string) {
  const first = await prisma.planItem.findFirstOrThrow({
    orderBy: { position: "asc" },
    where: { kind: "lesson", planId },
  });

  await prisma.planItem.update({ data: { status: "done" }, where: { id: first.id } });
}

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

    await expect(readPlan()).resolves.toMatchObject({ status: { kind: "pastDate", lessons } });

    await refreshGoalPlan({ goalId: goal.id });

    const left = await readLeftLessons(plan.id);
    expect(left.every((item) => item.status === "skipped")).toBe(true);

    const view = await readPlan();

    expect(view?.status).toStrictEqual({ kind: "pastDate", lessons });
    expect(view?.end).toBeNull();

    expect(view).not.toHaveProperty("pastDateOffer");

    const found = await findPlanTimeToCover({ goalId: goal.id, input: {} });
    const targetDate = found.status === "ready" ? found.time.fittingDate : null;

    expect(targetDate).toBe("2020-11-03");

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

    const moved = await readPlan();

    expect(moved?.status?.kind).not.toBe("pastDate");
    expect(moved?.status?.kind).not.toBe("behind");
  });

  it("doesn't say it covers everything while lessons it set aside are left", async () => {
    const { goal, plan } = await pastDateGoal("learn");

    await refreshGoalPlan({ goalId: goal.id });

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
    const { goal, plan, plannedLessons } = await pastDateGoal("exam", 6);
    expect(plannedLessons).toBeGreaterThan(1);

    await refreshGoalPlan({ goalId: goal.id });

    const { length: lessons } = await readLeftLessons(plan.id);
    const view = await readPlan();

    expect(lessons).toBeGreaterThan(0);
    expect(view?.status).toStrictEqual({ kind: "pastDate", lessons });

    const operations: PlanChangeInput["operations"] = [{ fullCourse: true, kind: "setFullCourse" }];

    const previewed = await preview(goal.id, operations);
    expect(previewed?.effect?.lessonsAdded).toBeGreaterThanOrEqual(lessons);

    await expect(findPlanTimeToCover({ goalId: goal.id, input: {} })).resolves.toMatchObject({
      status: "ready",
      time: { fittingDate: null, pastDate: true, suggested: null },
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
