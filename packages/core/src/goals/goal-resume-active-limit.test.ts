import { type Goal, prisma } from "@zoonk/db";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { holdLearnerLock, waitForBlockedStatement } from "../_test-utils/learner-lock";
import { mockSession } from "../_test-utils/mock-session";
import { planLibraryFixture, unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { createGoalPlan } from "../plans/create-goal-plan";
import { createOnboardingGoals } from "../view-models/onboarding/create-onboarding-goals";
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

/** A Free learner with no active goal, so one slot is free. */
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

  vi.setSystemTime(A_WEEK_LATER);

  return { goals, user };
}

function countActive(userId: string) {
  return prisma.goal.count({ where: { kind: { not: "explain" }, status: "active", userId } });
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
        limit: { limit: 1, period: "total", resource: "activeGoals", tier: "free" },
        status: "limitReached",
      });

      await expect(countActive(user.id)).resolves.toBe(1);
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
    await expect(countActive(user.id)).resolves.toBe(1);
  });
});
