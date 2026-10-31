import { prisma } from "@zoonk/db";
import { goalWithBasesFixture } from "@zoonk/testing/fixtures/plan-bases";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { markLearnerChanged } from "../learner/_utils/mark-learner-changed";
import {
  AHEAD_START,
  aheadPlanFixture,
  readPlanScreen,
  studyFaster,
} from "./_test-utils/ahead-plan";
import { changeGoalPlan } from "./change-goal-plan";
import { decidePlanChange } from "./decide-plan-change";
import { refreshGoalPlan } from "./refresh-goal-plan";

function countLessonsLeft(planId: string) {
  return prisma.planItem.count({
    where: { kind: { in: ["chapter", "lesson"] }, planId, status: "todo" },
  });
}

describe("lessons the learner's own time fits", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AHEAD_START);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("are offered at the learner's time once it covers what their date left out", async () => {
    const { goal, plan, user } = await aheadPlanFixture({ dailyMinutes: 15, faster: true });
    const before = await readPlanScreen();

    expect(before?.feasibility).toMatchObject({ coreFits: false, fits: false, timeCovers: false });

    expect(before?.fitOffer).toMatchObject({
      effect: { topicsAdded: [{ area: "Stocks" }] },
      fits: false,
      operations: [{ kind: "fitLessons" }],
    });

    expect(before?.fitOffer?.effect.lessonsAdded).toBeGreaterThan(0);

    await prisma.$transaction((tx) =>
      markLearnerChanged(tx, { planInputs: true, userId: user.id }),
    );

    const afterAnswer = await readPlanScreen();
    expect(afterAnswer?.fitOffer).toStrictEqual(before?.fitOffer);
    expect(afterAnswer?.fitOffer?.canApply).toBe(true);

    const applied = await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ kind: "fitLessons" }] },
    });

    expect(applied).toMatchObject({
      change: { effect: { lessonsAdded: before?.fitOffer?.effect.lessonsAdded } },
      status: "applied",
    });

    await expect(countLessonsLeft(plan.id)).resolves.toBeGreaterThan(0);

    await expect(readPlanScreen()).resolves.toMatchObject({
      feasibility: { coreFits: true, fits: before?.fitOffer?.fits },
      fitOffer: null,
    });

    await decidePlanChange({
      changeId: applied.status === "applied" ? (applied.change?.id ?? "") : "",
      goalId: goal.id,
      input: { status: "undone" },
    });

    await expect(countLessonsLeft(plan.id)).resolves.toBe(0);
    const undone = await readPlanScreen();

    expect(undone?.fitOffer).toMatchObject({
      effect: { topicsAdded: before?.fitOffer?.effect.topicsAdded },
      operations: [{ kind: "fitLessons" }],
    });
  });

  it("never come into a plan whose lessons are all done after a session: they're offered", async () => {
    const { goal, plan, user } = await aheadPlanFixture({ dailyMinutes: 15, days: 10 });

    const saved = await prisma.planItem.findMany({
      orderBy: { position: "asc" },
      where: { planId: plan.id },
    });

    await expect(countLessonsLeft(plan.id)).resolves.toBe(0);

    await studyFaster({ planId: plan.id, userId: user.id });

    await expect(refreshGoalPlan({ goalId: goal.id, pace: "sampled" })).resolves.toStrictEqual({
      status: "unchanged",
    });

    await expect(
      prisma.planItem.findMany({ orderBy: { position: "asc" }, where: { planId: plan.id } }),
    ).resolves.toStrictEqual(saved);

    const after = await readPlanScreen();
    expect(after?.fitOffer?.effect.lessonsAdded).toBeGreaterThan(0);

    await expect(
      changeGoalPlan({ goalId: goal.id, input: { operations: [{ kind: "fitLessons" }] } }),
    ).resolves.toMatchObject({
      change: { effect: { lessonsAdded: after?.fitOffer?.effect.lessonsAdded } },
      status: "applied",
    });

    const applied = await countLessonsLeft(plan.id);
    await refreshGoalPlan({ goalId: goal.id, pace: "sampled" });
    await expect(countLessonsLeft(plan.id)).resolves.toBe(applied);
  });

  it("says after Apply what the offer said at the plan's own pace", async () => {
    const { goal } = await aheadPlanFixture({ dailyMinutes: 15 });
    const before = await readPlanScreen();

    expect(before?.fitOffer).toMatchObject({ operations: [{ kind: "fitLessons" }] });

    await expect(
      changeGoalPlan({ goalId: goal.id, input: { operations: [{ kind: "fitLessons" }] } }),
    ).resolves.toMatchObject({ status: "applied" });

    const after = await readPlanScreen();

    expect({ offer: before?.fitOffer?.fits, read: after?.feasibility?.fits }).toStrictEqual({
      offer: false,
      read: false,
    });
  });
});

describe("a plan never laid out", () => {
  it("is laid out on its first read, whatever placement settled", async () => {
    const user = await userFixture();
    const { goal } = await goalWithBasesFixture({ days: 30, kind: "exam", userId: user.id });
    mockSession(user.id);

    await refreshGoalPlan({ goalId: goal.id, settleOnly: true });

    await expect(readPlanScreen()).resolves.toMatchObject({ ready: true });
  });
});
