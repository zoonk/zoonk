import { type TransactionClient, prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { freezeClock } from "../_test-utils/frozen-clock";
import { mockSession } from "../_test-utils/mock-session";
import { markLearnerChanged } from "../learner/_utils/mark-learner-changed";
import { buildPlan } from "../plans/planner/build-plan";
import { createOnboardingGoals } from "../view-models/onboarding/create-onboarding-goals";
import { findActiveGoalLimit } from "./_utils/goal-status";
import { createGoals } from "./create-goals";
import { type GoalDraft } from "./goal-contract";

vi.mock("../plans/planner/build-plan", { spy: true });

const FREE_LIMIT = { limit: 1, period: "total", resource: "activeGoals", tier: "free" };

function draft(attrs: Partial<GoalDraft> = {}): GoalDraft {
  return {
    kind: "learn",
    language: "en",
    prompt: "Understand physics",
    title: "Understand physics",
    ...attrs,
  };
}

async function setup({ plus = false } = {}) {
  const user = await userFixture();
  const goal = await goalFixture({ status: "paused", userId: user.id });
  const plan = await planFixture({ goalId: goal.id });
  await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });

  if (plus) {
    await prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    });
  }

  mockSession(user.id);
  return { goal, plan, user };
}

/**
 * Usage claims take the user row, while creation takes plans first. This real plan lock lets both
 * claims finish before either creation proceeds, without replacing any persistence behavior.
 */
async function holdPlan(planId: string) {
  const ready = Promise.withResolvers<TransactionClient>();
  const release = Promise.withResolvers<null>();

  const writing = prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM plans WHERE id = ${planId}::uuid FOR UPDATE`;
      ready.resolve(tx);
      await release.promise;
    },
    { timeout: 12_000 },
  );

  void writing.catch(ready.reject);
  const held = Promise.allSettled([writing]);

  return {
    finish: async () => {
      release.resolve(null);
      await expect(held).resolves.toMatchObject([{ status: "fulfilled" }]);
    },
    tx: await ready.promise,
  };
}

async function waitForClaims(userId: string, count: number) {
  await expect
    .poll(() => prisma.usageRecord.count({ where: { kind: "goal", userId } }), {
      interval: 10,
      timeout: 4000,
    })
    .toBe(count);
}

async function versions({ plan }: Awaited<ReturnType<typeof setup>>) {
  const saved = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
  return { inputVersion: saved.inputVersion };
}

describe("onboarding recounts active goals under the creation lock", () => {
  beforeEach(() => {
    freezeClock();
    vi.mocked(buildPlan).mockClear();
  });

  it("allows only one of two Free onboarding requests whose usage claims both passed", async () => {
    const day = await setup();
    const before = await versions(day);
    const holding = await holdPlan(day.plan.id);

    const opening = Promise.all([
      createOnboardingGoals({ dailyMinutes: 15, goals: [draft()] }),
      createOnboardingGoals({ dailyMinutes: 15, goals: [draft({ title: "Learn chemistry" })] }),
    ]);

    const settled = Promise.allSettled([opening]);

    try {
      await waitForClaims(day.user.id, 2);
    } finally {
      await holding.finish();
      await settled;
    }

    const results = await opening;
    expect(buildPlan).not.toHaveBeenCalled();
    expect(results.map((result) => result.status).toSorted()).toStrictEqual(["created", "refused"]);

    expect(results.find((result) => result.status === "refused")).toStrictEqual({
      refused: [{ decision: { limit: FREE_LIMIT, status: "limitReached" }, index: 0 }],
      status: "refused",
    });

    const created = results.flatMap((result) => (result.status === "created" ? result.goals : []));
    const active = await prisma.goal.findMany({ where: { status: "active", userId: day.user.id } });
    expect(active.map((goal) => goal.id)).toStrictEqual(created.map((goal) => goal.id));
    await expect(prisma.plan.count({ where: { goal: { userId: day.user.id } } })).resolves.toBe(2);

    await expect(
      prisma.userLearningProfile.findUniqueOrThrow({ where: { userId: day.user.id } }),
    ).resolves.toMatchObject({ activeGoalId: created[0]?.id });

    // Two claims, one creation and one profile switch; the refused creator's marker rolls back.
    await expect(versions(day)).resolves.toStrictEqual({ inputVersion: before.inputVersion + 2 });
  });

  it("refuses creation if another goal activates after its claim but before it takes the lock", async () => {
    const day = await setup();
    const before = await versions(day);
    const holding = await holdPlan(day.plan.id);
    const opening = createOnboardingGoals({ dailyMinutes: 15, goals: [draft()] });
    const settled = Promise.allSettled([opening]);

    try {
      await waitForClaims(day.user.id, 1);
      // D owns resumeGoal; this controlled writer exercises its canonical plan→user lock seam.
      await markLearnerChanged(holding.tx, { planInputs: true, userId: day.user.id });

      await expect(
        findActiveGoalLimit({ db: holding.tx, goalId: day.goal.id, userId: day.user.id }),
      ).resolves.toBeNull();

      await holding.tx.goal.update({ data: { status: "active" }, where: { id: day.goal.id } });
    } finally {
      await holding.finish();
      await settled;
    }

    await expect(opening).resolves.toStrictEqual({
      refused: [{ decision: { limit: FREE_LIMIT, status: "limitReached" }, index: 0 }],
      status: "refused",
    });

    expect(buildPlan).not.toHaveBeenCalled();

    await expect(prisma.goal.count({ where: { userId: day.user.id } })).resolves.toBe(1);
    await expect(prisma.plan.count({ where: { goal: { userId: day.user.id } } })).resolves.toBe(1);

    await expect(versions(day)).resolves.toStrictEqual({ inputVersion: before.inputVersion + 1 });
  });

  it("keeps both simultaneous goals available to Plus", async () => {
    const day = await setup({ plus: true });
    const holding = await holdPlan(day.plan.id);

    const opening = Promise.all([
      createOnboardingGoals({ dailyMinutes: 15, goals: [draft()] }),
      createOnboardingGoals({ dailyMinutes: 15, goals: [draft({ title: "Learn chemistry" })] }),
    ]);

    const settled = Promise.allSettled([opening]);

    try {
      await waitForClaims(day.user.id, 2);
    } finally {
      await holding.finish();
      await settled;
    }

    const results = await opening;
    expect(results.map((result) => result.status)).toStrictEqual(["created", "created"]);

    await expect(
      prisma.goal.count({ where: { status: "active", userId: day.user.id } }),
    ).resolves.toBe(2);
  });

  it("does not take an active slot for an explanation or change the followed goal", async () => {
    const day = await setup();
    await prisma.goal.update({ data: { status: "active" }, where: { id: day.goal.id } });

    await expect(
      createOnboardingGoals({ dailyMinutes: 15, goals: [draft({ kind: "explain" })] }),
    ).resolves.toMatchObject({ goals: [{ isActive: false, kind: "explain" }], status: "created" });

    await expect(
      prisma.userLearningProfile.findUniqueOrThrow({ where: { userId: day.user.id } }),
    ).resolves.toMatchObject({ activeGoalId: day.goal.id });
  });

  it("keeps an owned replacement outside the new-goal allowance", async () => {
    const day = await setup();
    await prisma.goal.update({ data: { status: "active" }, where: { id: day.goal.id } });

    await expect(
      createGoals({ dailyMinutes: 15, goals: [draft()] }, { replacesGoalId: day.goal.id }),
    ).resolves.toMatchObject({ goals: [{ isActive: true }], status: "created" });

    await expect(prisma.usageRecord.count({ where: { userId: day.user.id } })).resolves.toBe(0);
  });
});
