import { randomUUID } from "node:crypto";
import { isRateLimited } from "@zoonk/auth/rate-limit";
import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { claimUsage } from "./claim-usage";
import { getDailySpendBudgetMicros, getEstimatedCostMicros } from "./limits";
import type * as RateLimit from "@zoonk/auth/rate-limit";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

/** The Vercel Firewall only answers on Vercel, so tests stand in for the adapter that asks it. */
vi.mock("@zoonk/auth/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof RateLimit>()),
  isRateLimited: vi.fn(),
}));

/** Mid-month and mid-day, so seeded usage lands in the periods the test means. */
const NOW = new Date("2026-09-15T12:00:00Z");
const EARLIER_THIS_MONTH = new Date("2026-09-03T09:00:00Z");
const MINUTE_MS = 60_000;

async function useLearner({ plus = false }: { plus?: boolean } = {}) {
  const user = await userFixture();

  if (plus) {
    await prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    });
  }

  mockSession(user.id);
  return user;
}

function startLesson({ generated = false, lessonId = randomUUID() } = {}) {
  return claimUsage({ generated, kind: "lessonStart", targetId: lessonId });
}

describe(claimUsage, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    vi.mocked(isRateLimited).mockResolvedValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("needs a session", async () => {
    mockSession(null);

    await expect(startLesson()).resolves.toStrictEqual({ status: "unauthorized" });
  });

  it("counts every new lesson a free learner starts, reused or generated, up to 20 a day", async () => {
    const user = await useLearner();

    await expect(startLesson({ generated: false })).resolves.toStrictEqual({ status: "allowed" });
    await expect(startLesson({ generated: true })).resolves.toStrictEqual({ status: "allowed" });
    await usageRecordsFixture({ count: 18, createdAt: NOW, userId: user.id });

    await expect(startLesson()).resolves.toStrictEqual({
      limit: { limit: 20, period: "day", resource: "lessonStart", tier: "free" },
      status: "limitReached",
    });

    await expect(prisma.usageRecord.count({ where: { userId: user.id } })).resolves.toBe(20);
  });

  it("lets a learner restart a lesson they already started without counting it again", async () => {
    const user = await useLearner();
    const lessonId = randomUUID();

    await startLesson({ lessonId });
    await usageRecordsFixture({ count: 19, createdAt: NOW, userId: user.id });

    await expect(startLesson({ lessonId })).resolves.toStrictEqual({ status: "allowed" });
    await expect(prisma.usageRecord.count({ where: { userId: user.id } })).resolves.toBe(20);
  });

  it("stops a free learner at 40 new lessons a month", async () => {
    const user = await useLearner();
    await usageRecordsFixture({ count: 40, createdAt: EARLIER_THIS_MONTH, userId: user.id });

    await expect(startLesson()).resolves.toMatchObject({
      limit: { limit: 40, period: "month", resource: "lessonStart" },
      status: "limitReached",
    });
  });

  it("keeps quick explanations out of the lesson allowance", async () => {
    const user = await useLearner();
    await usageRecordsFixture({ count: 20, createdAt: NOW, userId: user.id });

    await expect(
      claimUsage({ generated: true, kind: "explanation", targetId: randomUUID() }),
    ).resolves.toStrictEqual({ status: "allowed" });
  });

  it("gives Plus unlimited lessons but spaces them out above 200 a day", async () => {
    const user = await useLearner({ plus: true });
    const lastStart = new Date(NOW.getTime() - MINUTE_MS);

    await usageRecordsFixture({ count: 200, createdAt: lastStart, userId: user.id });

    await expect(startLesson()).resolves.toStrictEqual({
      retryAfterSeconds: 240,
      status: "slowDown",
    });

    vi.setSystemTime(new Date(NOW.getTime() + 4 * MINUTE_MS));

    await expect(startLesson()).resolves.toStrictEqual({ status: "allowed" });
  });

  it("gives free learners a small daily tutor allowance", async () => {
    const user = await useLearner();
    await usageRecordsFixture({ count: 10, createdAt: NOW, kind: "tutorMessage", userId: user.id });

    await expect(
      claimUsage({ kind: "tutorMessage", targetId: randomUUID() }),
    ).resolves.toMatchObject({
      limit: { limit: 10, period: "day", resource: "tutorMessage" },
      status: "limitReached",
    });
  });

  it.each(["upload", "conversation", "goal"] as const)(
    "caps a free learner's %s at 3 a day",
    async (kind) => {
      const user = await useLearner();
      await usageRecordsFixture({ count: 3, createdAt: NOW, kind, userId: user.id });

      await expect(claimUsage({ kind, targetId: randomUUID() })).resolves.toStrictEqual({
        limit: { limit: 3, period: "day", resource: kind, tier: "free" },
        status: "limitReached",
      });

      vi.setSystemTime(new Date(NOW.getTime() + 24 * 60 * MINUTE_MS));

      await expect(claimUsage({ kind, targetId: randomUUID() })).resolves.toStrictEqual({
        status: "allowed",
      });
    },
  );

  it("spaces out a free learner's quick explanations above 30 a day instead of blocking them", async () => {
    const user = await useLearner();
    const lastExplanation = new Date(NOW.getTime() - MINUTE_MS);

    await usageRecordsFixture({
      count: 30,
      createdAt: lastExplanation,
      kind: "explanation",
      userId: user.id,
    });

    await expect(
      claimUsage({ generated: true, kind: "explanation", targetId: randomUUID() }),
    ).resolves.toStrictEqual({ retryAfterSeconds: 240, status: "slowDown" });
  });

  it("keeps free learners to one active goal and caps new goals a day for Plus", async () => {
    const [free, plus] = await Promise.all([userFixture(), userFixture()]);

    await Promise.all([
      goalFixture({ userId: free.id }),
      prisma.subscription.create({
        data: { plan: "plus", provider: "zoonk", referenceId: plus.id, status: "active" },
      }),
      usageRecordsFixture({ count: 10, createdAt: NOW, kind: "goal", userId: plus.id }),
    ]);

    mockSession(free.id);

    await expect(claimUsage({ kind: "goal", targetId: randomUUID() })).resolves.toMatchObject({
      limit: { limit: 1, period: "total", resource: "activeGoals" },
    });

    mockSession(plus.id);

    await expect(claimUsage({ kind: "goal", targetId: randomUUID() })).resolves.toMatchObject({
      limit: { limit: 10, period: "day", resource: "goal", tier: "plus" },
    });
  });

  it("lets a free learner start the day's three new goals and a day of new lessons within the AI budget", async () => {
    const user = await useLearner();

    await Promise.all([
      usageRecordsFixture({
        costMicros: getEstimatedCostMicros({ generated: true, kind: "goal" }),
        count: 2,
        createdAt: NOW,
        kind: "goal",
        userId: user.id,
      }),
      usageRecordsFixture({
        costMicros: getEstimatedCostMicros({ generated: true, kind: "lessonStart" }),
        count: 19,
        createdAt: NOW,
        generated: true,
        userId: user.id,
      }),
    ]);

    await expect(claimUsage({ kind: "goal", targetId: randomUUID() })).resolves.toStrictEqual({
      status: "allowed",
    });

    await expect(startLesson({ generated: true })).resolves.toStrictEqual({ status: "allowed" });
  });

  it("stops generation for the day once the learner's AI budget is spent", async () => {
    const user = await useLearner();

    await usageRecordsFixture({
      costMicros: getDailySpendBudgetMicros("free") - 10_000,
      count: 1,
      createdAt: NOW,
      kind: "upload",
      userId: user.id,
    });

    await expect(startLesson({ generated: true })).resolves.toMatchObject({
      limit: { period: "day", resource: "aiSpend" },
    });

    await expect(startLesson({ generated: false })).resolves.toStrictEqual({ status: "allowed" });
  });

  it("slows the learner down when the firewall rate limit trips, keyed on the account", async () => {
    const user = await useLearner();
    vi.mocked(isRateLimited).mockResolvedValue(true);

    await expect(startLesson()).resolves.toStrictEqual({
      retryAfterSeconds: 60,
      status: "slowDown",
    });

    expect(isRateLimited).toHaveBeenCalledWith(
      expect.objectContaining({ key: `user:${user.id}`, rule: "lesson-start" }),
    );

    await expect(prisma.usageRecord.count({ where: { userId: user.id } })).resolves.toBe(0);
  });

  it("never lets parallel starts pass the daily cap together", async () => {
    const user = await useLearner();
    await usageRecordsFixture({ count: 19, createdAt: NOW, userId: user.id });

    const decisions = await Promise.all(Array.from({ length: 5 }, () => startLesson()));

    expect(decisions.filter((decision) => decision.status === "allowed")).toHaveLength(1);
    await expect(prisma.usageRecord.count({ where: { userId: user.id } })).resolves.toBe(20);
  });
});
