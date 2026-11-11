import { type Goal, prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { holdLearnerLock, waitForBlockedStatement } from "../_test-utils/learner-lock";
import { mockSession } from "../_test-utils/mock-session";
import { planLibraryFixture, unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { createGoalPlan } from "../plans/create-goal-plan";
import { createOnboardingGoals } from "../view-models/onboarding/create-onboarding-goals";
import { type GoalUpdateInput } from "./goal-contract";
import { updateGoal } from "./update-goal";

const MONDAY = new Date("2020-09-28T12:00:00Z");
const A_WEEK_LATER = new Date("2020-10-06T12:00:00Z");
const ANY_STATEMENT = /./u;

async function goalFor({ ready, userId }: { ready: boolean; userId: string }): Promise<Goal> {
  const { goal } = await unplannedGoalFixture({
    dailyMinutes: 12,
    settings: { startDate: "2020-09-28" },
    userId,
  });

  if (ready) {
    const library = await planLibraryFixture({ skills: [{ lessons: 4 }] });
    await createGoalPlan({ goalId: goal.id, graph: library.graph });
  }

  return goal;
}

/** A Free learner with two other active goals, so one of the three slots is free. */
async function pausedGoals({ count, ready }: { count: number; ready: boolean }) {
  const user = await userFixture();
  mockSession(user.id);

  const goals = await Promise.all(
    Array.from({ length: count }, () => goalFor({ ready, userId: user.id })),
  );

  await learningProfileFixture({ activeGoalId: goals[0]?.id, userId: user.id });

  await Promise.all(
    goals.map((goal) => updateGoal({ goalId: goal.id, input: { status: "paused" } })),
  );

  await Promise.all([goalFixture({ userId: user.id }), goalFixture({ userId: user.id })]);

  vi.setSystemTime(A_WEEK_LATER);

  return { goals, user };
}

function countActive(userId: string) {
  return prisma.goal.count({ where: { kind: { not: "explain" }, status: "active", userId } });
}

/** What a refused update must leave as it was; marks from other writes may move `inputVersion`. */
async function readGoalAndPlan(goalId: string) {
  const goal = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });

  const { inputVersion: _, ...plan } = await prisma.plan.findUniqueOrThrow({
    include: { changes: true, items: true },
    where: { goalId },
  });

  return { goal, plan };
}

/** Each writer passes any check made before the lock, then waits on it behind the ones before. */
async function queueBehindLearnerLock<T>(userId: string, writes: (() => Promise<T>)[]) {
  const holder = holdLearnerLock({ userId });
  const pid = await holder.pid;

  const started = await writes.reduce<Promise<Promise<T>[]>>(async (previous, write, index) => {
    const queued = await previous;
    const writing = write();
    void writing.catch(() => null);
    await waitForBlockedStatement(pid, ANY_STATEMENT, index + 1);
    return [...queued, writing];
  }, Promise.resolve([]));

  holder.release();
  await holder.done;

  return Promise.all(started);
}

describe("resuming a goal claims the active slot under the learner lock", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(MONDAY);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([{ ready: false }, { ready: true }])(
    "lets one of two simultaneous resumes take the one free slot (ready plan: $ready)",
    async ({ ready }) => {
      const { goals, user } = await pausedGoals({ count: 2, ready });

      const results = await queueBehindLearnerLock(
        user.id,
        goals.map((goal) => () => updateGoal({ goalId: goal.id, input: { status: "active" } })),
      );

      expect(results.map((result) => result.status)).toStrictEqual(["updated", "limitReached"]);
      expect(results[0]).toMatchObject({ change: ready ? { kind: "resumed" } : null });

      expect(results[1]).toStrictEqual({
        limit: { limit: 3, period: "total", resource: "activeGoals", tier: "free" },
        status: "limitReached",
      });

      await expect(countActive(user.id)).resolves.toBe(3);
    },
  );

  it("refuses a resume once a goal created first takes the free slot", async () => {
    const { goals, user } = await pausedGoals({ count: 1, ready: false });
    const [paused] = goals;

    const [created, resumed] = await queueBehindLearnerLock<{ status: string }>(user.id, [
      () =>
        createOnboardingGoals({
          dailyMinutes: 15,
          goals: [{ kind: "learn", language: "en", prompt: "Learn chemistry", title: "Chemistry" }],
        }),
      () => updateGoal({ goalId: paused?.id ?? "", input: { status: "active" } }),
    ]);

    expect(created).toMatchObject({ status: "created" });
    expect(resumed).toMatchObject({ status: "limitReached" });
    await expect(countActive(user.id)).resolves.toBe(3);
  });

  it.each<{ input: GoalUpdateInput; ready: boolean }>([
    { input: { dailyMinutes: 30, displayName: "Changed" }, ready: false },
    { input: { targetDate: "2021-06-01" }, ready: false },
    { input: { details: { reason: "Travel" }, timeZone: "America/Sao_Paulo" }, ready: false },
    { input: { dailyMinutes: 30, displayName: "Changed" }, ready: true },
    { input: { targetDate: "2021-06-01" }, ready: true },
    { input: { details: { reason: "Travel" }, timeZone: "America/Sao_Paulo" }, ready: true },
  ])(
    "changes nothing when a resume with $input is refused (ready plan: $ready)",
    async ({ input, ready }) => {
      const { goals, user } = await pausedGoals({ count: 2, ready });
      const [first, second] = goals;
      const before = await readGoalAndPlan(second?.id ?? "");

      const [resumed, refused] = await queueBehindLearnerLock(user.id, [
        () => updateGoal({ goalId: first?.id ?? "", input: { status: "active" } }),
        () => updateGoal({ goalId: second?.id ?? "", input: { ...input, status: "active" } }),
      ]);

      expect(resumed).toMatchObject({ status: "updated" });
      expect(refused).toMatchObject({ status: "limitReached" });
      await expect(readGoalAndPlan(second?.id ?? "")).resolves.toStrictEqual(before);
    },
  );

  it("returns the goal with its new schedule when a resume with a plan still in setup is saved", async () => {
    const { goals } = await pausedGoals({ count: 1, ready: false });

    await expect(
      updateGoal({ goalId: goals[0]?.id ?? "", input: { dailyMinutes: 30, status: "active" } }),
    ).resolves.toMatchObject({ goal: { dailyMinutes: 30, status: "active" }, status: "updated" });
  });
});
