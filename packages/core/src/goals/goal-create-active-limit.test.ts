import { type Goal, prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { freezeClock } from "../_test-utils/frozen-clock";
import { mockSession } from "../_test-utils/mock-session";
import { buildPlan } from "../plans/planner/build-plan";
import { createOnboardingGoals } from "../view-models/onboarding/create-onboarding-goals";
import { type GoalDraft } from "./goal-contract";

vi.mock("../plans/planner/build-plan", { spy: true });

const FREE_LIMIT = { limit: 3, period: "total", resource: "activeGoals", tier: "free" };

function draft(attrs: Partial<GoalDraft> = {}): GoalDraft {
  return {
    kind: "learn",
    language: "en",
    prompt: "Understand physics",
    title: "Understand physics",
    ...attrs,
  };
}

async function setup({ following = 0, plus = false } = {}) {
  const user = await userFixture();
  const goal = await goalFixture({ status: "paused", userId: user.id });
  const plan = await planFixture({ goalId: goal.id });
  await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });

  const followed = await Promise.all(
    Array.from({ length: following }, () => goalFixture({ userId: user.id })),
  );

  if (plus) {
    await prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    });
  }

  mockSession(user.id);
  return { followed, goal, plan, user };
}

async function versions({ plan }: Awaited<ReturnType<typeof setup>>) {
  const saved = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
  return { inputVersion: saved.inputVersion };
}

function countGoalClaims(userId: string) {
  return prisma.usageRecord.count({ where: { kind: "goal", userId } });
}

async function full() {
  const day = await setup({ following: 2 });
  await prisma.goal.update({ data: { status: "active" }, where: { id: day.goal.id } });
  return day;
}

async function statusOf(goalId: string) {
  const goal = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });
  return goal.status;
}

async function otherLearnersGoal() {
  const other = await userFixture();
  return goalFixture({ userId: other.id });
}

const FREE_LIMIT_REFUSAL = {
  refused: [{ decision: { limit: FREE_LIMIT, status: "limitReached" }, index: 0 }],
  status: "refused",
};

describe("onboarding counts active goals in the write that creates one", () => {
  beforeEach(() => {
    freezeClock();
    vi.mocked(buildPlan).mockClear();
  });

  it("allows only one of two simultaneous Free starts for the last slot and charges only that one", async () => {
    const day = await setup({ following: 2 });
    const before = await versions(day);

    const results = await Promise.all([
      createOnboardingGoals({ dailyMinutes: 15, goals: [draft()] }),
      createOnboardingGoals({ dailyMinutes: 15, goals: [draft({ title: "Learn chemistry" })] }),
    ]);

    expect(buildPlan).not.toHaveBeenCalled();
    expect(results.map((result) => result.status).toSorted()).toStrictEqual(["created", "refused"]);

    expect(results.find((result) => result.status === "refused")).toStrictEqual(FREE_LIMIT_REFUSAL);

    const created = results.flatMap((result) => (result.status === "created" ? result.goals : []));
    const active = await prisma.goal.findMany({ where: { status: "active", userId: day.user.id } });

    expect(active.map((goal) => goal.id).toSorted()).toStrictEqual(
      [...day.followed, ...created].map((goal) => goal.id).toSorted(),
    );

    await expect(prisma.plan.count({ where: { goal: { userId: day.user.id } } })).resolves.toBe(2);
    await expect(countGoalClaims(day.user.id)).resolves.toBe(1);

    await expect(
      prisma.userLearningProfile.findUniqueOrThrow({ where: { userId: day.user.id } }),
    ).resolves.toMatchObject({ activeGoalId: created[0]?.id });

    await expect(versions(day)).resolves.toStrictEqual({ inputVersion: before.inputVersion + 2 });
  });

  it("keeps both simultaneous goals available to Plus", async () => {
    const day = await setup({ plus: true });

    const results = await Promise.all([
      createOnboardingGoals({ dailyMinutes: 15, goals: [draft()] }),
      createOnboardingGoals({ dailyMinutes: 15, goals: [draft({ title: "Learn chemistry" })] }),
    ]);

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
});

describe("starting a goal at the active-goal limit can pause another to make room", () => {
  beforeEach(() => {
    freezeClock();
  });

  it("pauses the named active goal in the write that creates the new one", async () => {
    const day = await full();

    const result = await createOnboardingGoals({
      dailyMinutes: 15,
      goals: [draft()],
      pauseGoalId: day.goal.id,
    });

    expect(result).toMatchObject({ goals: [{ isActive: true, status: "active" }], refused: [] });
    await expect(statusOf(day.goal.id)).resolves.toBe("paused");
    await expect(countGoalClaims(day.user.id)).resolves.toBe(1);
  });

  it("keeps the named goal active when a creation cap refuses the start", async () => {
    const day = await full();

    await usageRecordsFixture({
      count: 3,
      createdAt: new Date(),
      kind: "goal",
      userId: day.user.id,
    });

    await expect(
      createOnboardingGoals({ dailyMinutes: 15, goals: [draft()], pauseGoalId: day.goal.id }),
    ).resolves.toStrictEqual({
      refused: [
        {
          decision: {
            limit: { limit: 3, period: "day", resource: "goal", tier: "free" },
            status: "limitReached",
          },
          index: 0,
        },
      ],
      status: "refused",
    });

    await expect(statusOf(day.goal.id)).resolves.toBe("active");
    await expect(prisma.goal.count({ where: { userId: day.user.id } })).resolves.toBe(3);
  });

  it("refuses at the limit without a goal to pause, charging nothing", async () => {
    const day = await full();

    await expect(
      createOnboardingGoals({ dailyMinutes: 15, goals: [draft()] }),
    ).resolves.toStrictEqual(FREE_LIMIT_REFUSAL);

    await expect(statusOf(day.goal.id)).resolves.toBe("active");
    await expect(countGoalClaims(day.user.id)).resolves.toBe(0);
  });

  it.each<{ name: string; other: (userId: string) => Promise<Goal> }>([
    { name: "another learner's active goal", other: otherLearnersGoal },
    {
      name: "a goal already paused",
      other: async (userId) => goalFixture({ status: "paused", userId }),
    },
    { name: "an explanation", other: async (userId) => goalFixture({ kind: "explain", userId }) },
  ])("pauses nothing and refuses at the limit when it names $name", async ({ other }) => {
    const day = await full();
    const named = await other(day.user.id);

    await expect(
      createOnboardingGoals({ dailyMinutes: 15, goals: [draft()], pauseGoalId: named.id }),
    ).resolves.toStrictEqual(FREE_LIMIT_REFUSAL);

    await expect(statusOf(day.goal.id)).resolves.toBe("active");
    await expect(statusOf(named.id)).resolves.toBe(named.status);
    await expect(countGoalClaims(day.user.id)).resolves.toBe(0);
  });
});
