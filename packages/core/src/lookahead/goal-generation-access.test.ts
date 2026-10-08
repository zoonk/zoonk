import { isRateLimited } from "@zoonk/auth/rate-limit";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getGoalGenerationAccess } from "./goal-generation-access";
import type * as RateLimit from "@zoonk/auth/rate-limit";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

/** The Vercel Firewall only answers on Vercel, so tests stand in for the adapter that asks it. */
vi.mock("@zoonk/auth/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof RateLimit>()),
  isRateLimited: vi.fn(),
}));

async function learnerGoal({ built }: { built: boolean }) {
  const user = await userFixture();
  const goal = await goalFixture({ userId: user.id });
  await planFixture({ generatedAt: built ? new Date() : null, goalId: goal.id });
  mockSession(user.id);
  return { goal, user };
}

describe(getGoalGenerationAccess, () => {
  beforeEach(() => {
    vi.mocked(isRateLimited).mockResolvedValue(false);
  });

  it("starts a goal's first run with its research without counting it: the goal was claimed", async () => {
    const { goal, user } = await learnerGoal({ built: false });

    await expect(
      getGoalGenerationAccess({ goalId: goal.id, withResearch: true }),
    ).resolves.toMatchObject({ goal: { id: goal.id }, status: "ready" });

    await expect(prisma.usageRecord.count({ where: { userId: user.id } })).resolves.toBe(0);
  });

  it("counts reconciling a built plan with newer research as small AI help, up to the free plan's cap", async () => {
    const { goal, user } = await learnerGoal({ built: true });

    await expect(
      getGoalGenerationAccess({ goalId: goal.id, withResearch: true }),
    ).resolves.toMatchObject({ status: "ready" });

    await expect(
      prisma.usageRecord.count({ where: { kind: "assist", userId: user.id } }),
    ).resolves.toBe(1);

    await usageRecordsFixture({ count: 99, kind: "assist", userId: user.id });

    await expect(
      getGoalGenerationAccess({ goalId: goal.id, withResearch: true }),
    ).resolves.toStrictEqual({
      limit: { limit: 100, period: "day", resource: "assist", tier: "free" },
      status: "limitReached",
    });

    // Retrying a run without new research only redoes what's missing, so it isn't counted.
    await expect(getGoalGenerationAccess({ goalId: goal.id })).resolves.toMatchObject({
      status: "ready",
    });
  });

  it("keeps another learner's goal hidden", async () => {
    const { goal } = await learnerGoal({ built: true });
    const stranger = await userFixture();
    mockSession(stranger.id);

    await expect(
      getGoalGenerationAccess({ goalId: goal.id, withResearch: true }),
    ).resolves.toStrictEqual({ status: "notFound" });
  });
});
