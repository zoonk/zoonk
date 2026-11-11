import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getWeeklyChallenge } from "../checkpoints/get-weekly-challenge";
import { getGoalPlan } from "../plans/get-goal-plan";
import { openTodayView } from "./_test-utils/open-today-view";
import {
  DAY_MS,
  SESSION_NOW,
  SESSION_TODAY,
  checkpointItemFixture,
  sessionGoalFixture,
} from "./_test-utils/session-goal";

const YESTERDAY = new Date(SESSION_TODAY.getTime() - DAY_MS);

async function examWithYesterdaysMock({ plus = false }: { plus?: boolean } = {}) {
  const user = await userFixture();

  const { goal, plan } = await sessionGoalFixture({
    goal: { kind: "exam" },
    itemsPerSkill: 10,
    userId: user.id,
  });

  if (plus) {
    await prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    });
  }

  const mock = await checkpointItemFixture({
    kind: "mock",
    planId: plan.id,
    position: 10,
    scheduledFor: YESTERDAY,
  });

  mockSession(user.id);

  return { goal, mock };
}

async function readDay(goalId: string) {
  const { today } = await openTodayView({ goalId, timeZone: "UTC" });
  const [weekly, plan] = await Promise.all([getWeeklyChallenge({ goalId }), getGoalPlan(goalId)]);

  return {
    fullReview: today.session.blocks.some((block) => block.fullReview),
    learn: today.session.blocks.some((block) => block.kind === "learn"),
    mockBlock: today.session.blocks.some((block) => block.checkpoint?.mock),
    nextMock:
      plan.status === "ready"
        ? (plan.plan.phases.find((phase) => phase.mocks.count > 0)?.mocks.nextDate ?? null)
        : plan.status,
    todayWeekly: today.weeklyChallenge?.planItemId ?? null,
    weekly: weekly.status === "ready" ? (weekly.challenge?.planItemId ?? null) : weekly.status,
  };
}

describe("the day after a mock day", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => vi.useRealTimers());

  it("is an ordinary day for a free learner, and the Plus-only mock is no longer the week's challenge", async () => {
    const { goal } = await examWithYesterdaysMock();

    await expect(readDay(goal.id)).resolves.toStrictEqual({
      fullReview: false,
      learn: true,
      mockBlock: false,
      nextMock: null,
      todayWeekly: null,
      weekly: null,
    });
  });

  it("still offers a Plus learner the mock they missed", async () => {
    const { goal, mock } = await examWithYesterdaysMock({ plus: true });

    await expect(readDay(goal.id)).resolves.toMatchObject({
      fullReview: false,
      mockBlock: true,
      nextMock: "2026-09-29",
      todayWeekly: mock.id,
      weekly: mock.id,
    });
  });
});
