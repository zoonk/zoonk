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

function makeMindMap() {
  return claimUsage({ generated: true, kind: "mindMap", targetId: randomUUID() });
}

/** Every metered kind a free learner can use, with its caps (calls are capped by time instead). */
const FREE_CAPS = [
  { day: 100, kind: "assist", month: 500 },
  { day: 5, kind: "explanation", month: 20 },
  { day: 3, kind: "goal", month: 10 },
  { day: 20, kind: "lessonStart", month: 40 },
  { day: 3, kind: "mindMap", month: 10 },
  { day: 10, kind: "tutorMessage", month: 100 },
  { day: 3, kind: "upload", month: 10 },
] as const;

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

  it.each(["upload", "goal"] as const)("caps a free learner's %s at 3 a day", async (kind) => {
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
  });

  it("caps a free learner's new mind maps at 3 a day and 10 a month", async () => {
    const user = await useLearner();
    await usageRecordsFixture({ count: 3, createdAt: NOW, kind: "mindMap", userId: user.id });

    await expect(makeMindMap()).resolves.toStrictEqual({
      limit: { limit: 3, period: "day", resource: "mindMap", tier: "free" },
      status: "limitReached",
    });

    await usageRecordsFixture({
      count: 7,
      createdAt: EARLIER_THIS_MONTH,
      kind: "mindMap",
      userId: user.id,
    });

    vi.setSystemTime(new Date(NOW.getTime() + 24 * 60 * MINUTE_MS));

    await expect(makeMindMap()).resolves.toStrictEqual({
      limit: { limit: 10, period: "month", resource: "mindMap", tier: "free" },
      status: "limitReached",
    });
  });

  it("holds a call's length from the day's call time, priced by the second", async () => {
    const user = await useLearner();
    const targetId = randomUUID();

    await expect(
      claimUsage({ kind: "conversation", seconds: 120, targetId }),
    ).resolves.toStrictEqual({ heldSeconds: 120, status: "allowed" });

    await expect(
      prisma.usageRecord.findUniqueOrThrow({
        where: { userUsageTarget: { kind: "conversation", targetId, userId: user.id } },
      }),
    ).resolves.toMatchObject({
      costMicros: getEstimatedCostMicros({ generated: false, kind: "conversation", seconds: 120 }),
      seconds: 120,
    });

    expect(getEstimatedCostMicros({ generated: false, kind: "conversation", seconds: 120 })).toBe(
      110_000,
    );
  });

  it("gives Plus 20 minutes of calls a day: the last call runs what's left, then calls wait for tomorrow", async () => {
    const user = await useLearner({ plus: true });

    await usageRecordsFixture({
      count: 1,
      createdAt: NOW,
      kind: "conversation",
      seconds: 19 * 60,
      userId: user.id,
    });

    await expect(
      claimUsage({ kind: "conversation", seconds: 300, targetId: randomUUID() }),
    ).resolves.toStrictEqual({ heldSeconds: 60, shortenedBy: "day", status: "allowed" });

    await expect(
      claimUsage({ kind: "conversation", seconds: 120, targetId: randomUUID() }),
    ).resolves.toStrictEqual({
      limit: { limit: 1200, period: "day", resource: "callSeconds", tier: "plus" },
      status: "limitReached",
    });

    vi.setSystemTime(new Date(NOW.getTime() + 24 * 60 * MINUTE_MS));

    await expect(
      claimUsage({ kind: "conversation", seconds: 120, targetId: randomUUID() }),
    ).resolves.toStrictEqual({ heldSeconds: 120, status: "allowed" });
  });

  it("caps a month of Plus's calls too: the last call runs what's left, then calls wait for next month", async () => {
    const user = await useLearner({ plus: true });

    // 85 minutes on earlier days this month: two of the month's minutes are left.
    await usageRecordsFixture({
      count: 5,
      createdAt: EARLIER_THIS_MONTH,
      kind: "conversation",
      seconds: 17 * 60,
      userId: user.id,
    });

    await expect(
      claimUsage({ kind: "conversation", seconds: 300, targetId: randomUUID() }),
    ).resolves.toStrictEqual({ heldSeconds: 120, shortenedBy: "month", status: "allowed" });

    // Tomorrow brings no call time back: the month's is used.
    vi.setSystemTime(new Date(NOW.getTime() + 24 * 60 * MINUTE_MS));

    await expect(
      claimUsage({ kind: "conversation", seconds: 120, targetId: randomUUID() }),
    ).resolves.toStrictEqual({
      limit: { limit: 5220, period: "month", resource: "callSeconds", tier: "plus" },
      status: "limitReached",
    });

    // A second before the month ends, still none; on the 1st, by the server's clock, it's back.
    vi.setSystemTime(new Date("2026-09-30T23:59:59Z"));

    await expect(
      claimUsage({ kind: "conversation", seconds: 120, targetId: randomUUID() }),
    ).resolves.toMatchObject({ limit: { period: "month" }, status: "limitReached" });

    vi.setSystemTime(new Date("2026-10-01T00:00:00Z"));

    await expect(
      claimUsage({ kind: "conversation", seconds: 120, targetId: randomUUID() }),
    ).resolves.toStrictEqual({ heldSeconds: 120, status: "allowed" });
  });

  it("gives the free plan a much smaller month of calls than Plus", async () => {
    const user = await useLearner();

    // 4 minutes on earlier days this month leave one: a minute-long call fits, nothing after it.
    await usageRecordsFixture({
      count: 1,
      createdAt: EARLIER_THIS_MONTH,
      kind: "conversation",
      seconds: 4 * 60,
      userId: user.id,
    });

    await expect(
      claimUsage({ kind: "conversation", seconds: 120, targetId: randomUUID() }),
    ).resolves.toStrictEqual({ heldSeconds: 60, shortenedBy: "month", status: "allowed" });

    await expect(
      claimUsage({ kind: "conversation", seconds: 60, targetId: randomUUID() }),
    ).resolves.toStrictEqual({
      limit: { limit: 300, period: "month", resource: "callSeconds", tier: "free" },
      status: "limitReached",
    });
  });

  it("refuses a call with less than a minute of the free plan's 2 a day left", async () => {
    const user = await useLearner();

    await usageRecordsFixture({
      count: 1,
      createdAt: NOW,
      kind: "conversation",
      seconds: 61,
      userId: user.id,
    });

    await expect(
      claimUsage({ kind: "conversation", seconds: 60, targetId: randomUUID() }),
    ).resolves.toStrictEqual({
      limit: { limit: 120, period: "day", resource: "callSeconds", tier: "free" },
      status: "limitReached",
    });
  });

  it("keeps what a dropped call ran when it connects again, and holds its length again", async () => {
    const user = await useLearner();
    const targetId = randomUUID();

    await claimUsage({ kind: "conversation", seconds: 60, targetId });
    vi.setSystemTime(new Date(NOW.getTime() + 30_000));

    await expect(
      claimUsage({ kind: "conversation", seconds: 60, targetId }),
    ).resolves.toStrictEqual({ heldSeconds: 60, status: "allowed" });

    await expect(
      prisma.usageRecord.findUniqueOrThrow({
        where: { userUsageTarget: { kind: "conversation", targetId, userId: user.id } },
      }),
    ).resolves.toMatchObject({ seconds: 90 });

    // Another drop: what's left of the day's 2 minutes is too short for a call.
    vi.setSystemTime(new Date(NOW.getTime() + 90_000));

    await expect(
      claimUsage({ kind: "conversation", seconds: 60, targetId }),
    ).resolves.toStrictEqual({
      limit: { limit: 120, period: "day", resource: "callSeconds", tier: "free" },
      status: "limitReached",
    });
  });

  it.each(FREE_CAPS)(
    "stops a free learner's $kind at $day a day and $month a month: no AI work is unlimited on the free plan",
    async ({ day, kind, month }) => {
      const user = await useLearner();
      await usageRecordsFixture({ count: day, createdAt: NOW, kind, userId: user.id });

      await expect(
        claimUsage({ generated: true, kind, targetId: randomUUID() }),
      ).resolves.toStrictEqual({
        limit: { limit: day, period: "day", resource: kind, tier: "free" },
        status: "limitReached",
      });

      const other = await useLearner();

      await usageRecordsFixture({
        count: month,
        createdAt: EARLIER_THIS_MONTH,
        kind,
        userId: other.id,
      });

      await expect(
        claimUsage({ generated: true, kind, targetId: randomUUID() }),
      ).resolves.toStrictEqual({
        limit: { limit: month, period: "month", resource: kind, tier: "free" },
        status: "limitReached",
      });
    },
  );

  it("keeps fair use for Plus's small AI help and quick explanations, spacing them out instead of blocking", async () => {
    const user = await useLearner({ plus: true });
    const lastUse = new Date(NOW.getTime() - MINUTE_MS);

    await Promise.all([
      usageRecordsFixture({ count: 1000, createdAt: lastUse, kind: "assist", userId: user.id }),
      usageRecordsFixture({ count: 200, createdAt: lastUse, kind: "explanation", userId: user.id }),
    ]);

    await expect(claimUsage({ kind: "assist", targetId: randomUUID() })).resolves.toStrictEqual({
      retryAfterSeconds: 240,
      status: "slowDown",
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

  it("lets a free learner start the day's three new goals, a day of new lessons and mind maps within the AI budget", async () => {
    const user = await useLearner();

    await Promise.all([
      usageRecordsFixture({
        costMicros: getEstimatedCostMicros({ generated: true, kind: "mindMap" }),
        count: 3,
        createdAt: NOW,
        generated: true,
        kind: "mindMap",
        userId: user.id,
      }),
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
