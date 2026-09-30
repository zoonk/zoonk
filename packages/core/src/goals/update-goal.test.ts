import { isRateLimited } from "@zoonk/auth/rate-limit";
import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runDeferredWork } from "../_test-utils/deferred-work";
import { mockSession } from "../_test-utils/mock-session";
import { trackServerEvent } from "../analytics/server";
import { planLibraryFixture, unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { createGoalPlan } from "../plans/create-goal-plan";
import { updateGoal } from "./update-goal";
import type * as RateLimit from "@zoonk/auth/rate-limit";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

// PostHog is an external service; the mock records what would leave the server.
vi.mock("../analytics/server", () => ({ trackServerEvent: vi.fn() }));

vi.mock("@zoonk/auth/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof RateLimit>()),
  isRateLimited: vi.fn(),
}));

/**
 * A Monday in 2020, before the learning events other tests write: estimates read everyone's recent
 * pace, and this keeps it out of the dates these tests expect.
 */
const MONDAY = new Date("2020-09-28T12:00:00Z");

async function setup() {
  const user = await userFixture();
  const library = await planLibraryFixture({ skills: [{ lessons: 8 }, { lessons: 6 }] });

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 12,
    settings: { startDate: "2020-09-28" },
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });
  await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });
  mockSession(user.id);

  return { goal, plan, user };
}

describe(updateGoal, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(MONDAY);
    vi.mocked(isRateLimited).mockResolvedValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("updates plain fields without touching the plan", async () => {
    const { goal, plan } = await setup();

    const result = await updateGoal({
      goalId: goal.id,
      input: { studyTime: "07:30", title: "Physics" },
    });

    expect(result).toMatchObject({
      change: null,
      goal: { studyTime: "07:30", title: "Physics" },
      status: "updated",
    });

    await expect(prisma.planChange.count({ where: { planId: plan.id } })).resolves.toBe(0);
  });

  it("re-plans when the learner's time or days change, with a change they can undo", async () => {
    const { goal, plan } = await setup();

    const result = await updateGoal({
      goalId: goal.id,
      input: { dailyMinutes: 30, studyDays: [1, 2, 3, 4, 5] },
    });

    expect(result).toMatchObject({
      change: { canUndo: true, kind: "edited", source: "learner" },
      goal: { dailyMinutes: 30, studyDays: [1, 2, 3, 4, 5] },
      status: "updated",
    });

    const stored = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    expect(stored.settings).toMatchObject({ weekdayMinutes: [0, 30, 30, 30, 30, 30, 0] });

    const weekend = await prisma.planItem.count({
      where: {
        planId: plan.id,
        scheduledFor: { in: [new Date("2020-10-03"), new Date("2020-10-04")] },
      },
    });

    expect(weekend).toBe(0);
  });

  it("refuses a past target date", async () => {
    const { goal } = await setup();

    await expect(
      updateGoal({ goalId: goal.id, input: { targetDate: "2020-09-01" } }),
    ).resolves.toStrictEqual({ error: "pastDate", status: "invalid" });
  });

  it("pauses and resumes from today, counting the free plan's one active goal", async () => {
    const { goal, plan, user } = await setup();

    await expect(
      updateGoal({ goalId: goal.id, input: { status: "paused" } }),
    ).resolves.toMatchObject({ goal: { status: "paused" } });

    const other = await goalFixture({ userId: user.id });
    const blocked = await updateGoal({ goalId: goal.id, input: { status: "active" } });
    expect(blocked).toMatchObject({ limit: { resource: "activeGoals" }, status: "limitReached" });

    await prisma.goal.update({ data: { status: "paused" }, where: { id: other.id } });
    vi.setSystemTime(new Date("2020-10-06T12:00:00Z"));

    const resumed = await updateGoal({ goalId: goal.id, input: { status: "active" } });

    expect(resumed).toMatchObject({
      change: { kind: "resumed" },
      goal: { status: "active" },
      status: "updated",
    });

    const first = await prisma.planItem.findFirstOrThrow({
      orderBy: { position: "asc" },
      where: { planId: plan.id, status: "todo" },
    });

    expect(first.scheduledFor?.toISOString().slice(0, 10)).toBe("2020-10-06");
  });

  it("moves the tabs to another active goal when the shown one is archived", async () => {
    const { goal, user } = await setup();
    const other = await goalFixture({ userId: user.id });

    await updateGoal({ goalId: goal.id, input: { status: "archived" } });

    const profile = await prisma.userLearningProfile.findUniqueOrThrow({
      where: { userId: user.id },
    });

    expect(profile.activeGoalId).toBe(other.id);
  });

  it('sends "Goal Reached" once when the learner completes a goal', async () => {
    const { goal, user } = await setup();

    await prisma.goal.update({
      data: { createdAt: new Date("2020-09-18T12:00:00Z") },
      where: { id: goal.id },
    });

    const flush = runDeferredWork();
    vi.mocked(trackServerEvent).mockClear();

    await updateGoal({ goalId: goal.id, input: { status: "completed" } });
    await updateGoal({ goalId: goal.id, input: { status: "completed" } });
    await flush();

    expect(trackServerEvent).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        distinctId: user.id,
        name: "Goal Reached",
        properties: { days: 10, goal_id: goal.id },
      }),
    );
  });

  it("hides other learners' goals", async () => {
    const { goal } = await setup();
    const stranger = await userFixture();
    mockSession(stranger.id);

    await expect(updateGoal({ goalId: goal.id, input: { title: "Mine" } })).resolves.toStrictEqual({
      status: "notFound",
    });
  });
});
