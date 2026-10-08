import { randomUUID } from "node:crypto";
import { captureMessage } from "@sentry/nextjs";
import { isRateLimited } from "@zoonk/auth/rate-limit";
import { prisma } from "@zoonk/db";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockGuestSession, mockSession } from "../_test-utils/mock-session";
import { claimUsage } from "./claim-usage";
import { NEWCOMER_DAILY_SPEND_BUDGET_MICROS, getEstimatedCostMicros } from "./limits";
import type * as RateLimit from "@zoonk/auth/rate-limit";

vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn() }));

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

vi.mock("next/headers", () => ({
  headers: vi.fn(
    async () =>
      new Headers({ "x-real-ip": "198.51.100.23", "x-vercel-ja4-digest": "t13d1516h2_test" }),
  ),
}));

/** The Vercel Firewall only answers on Vercel, so tests stand in for the adapter that asks it. */
vi.mock("@zoonk/auth/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof RateLimit>()),
  isRateLimited: vi.fn(),
}));

async function useGuest() {
  const guest = await userFixture();
  await prisma.user.update({ data: { isAnonymous: true }, where: { id: guest.id } });

  mockGuestSession(guest.id);
  return guest;
}

function startLesson({ generated = false } = {}) {
  return claimUsage({ generated, kind: "lessonStart", targetId: randomUUID() });
}

/**
 * A day of its own, so the budget newcomers share in other tests never mixes in. Rows outlive a
 * run in the shared test database, so a day an earlier run drew starts empty again.
 */
async function useIsolatedDay() {
  const day = Math.floor(Math.random() * 10_000);
  vi.setSystemTime(new Date(Date.UTC(2200, 0, 1 + day, 12)));
  await prisma.newcomerSpendDay.deleteMany({ where: { day: today() } });
}

function today() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

describe("guest and newcomer usage", () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    await useIsolatedDay();
    vi.mocked(isRateLimited).mockResolvedValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("gives a guest three lessons, at most one of them newly generated", async () => {
    await useGuest();

    await expect(startLesson({ generated: true })).resolves.toStrictEqual({ status: "allowed" });

    await expect(startLesson({ generated: true })).resolves.toStrictEqual({
      limit: { limit: 1, period: "total", resource: "generatedLessons", tier: "guest" },
      status: "limitReached",
    });

    await expect(startLesson()).resolves.toStrictEqual({ status: "allowed" });
    await expect(startLesson()).resolves.toStrictEqual({ status: "allowed" });

    await expect(startLesson()).resolves.toStrictEqual({
      limit: { limit: 3, period: "total", resource: "lessonStart", tier: "guest" },
      status: "limitReached",
    });
  });

  it("lets a guest start one goal and no tutor, uploads or AI conversations", async () => {
    const guest = await useGuest();
    await usageRecordsFixture({ count: 1, kind: "goal", userId: guest.id });

    const claims = await Promise.all(
      (["goal", "tutorMessage", "upload", "conversation"] as const).map((kind) =>
        claimUsage({ kind, targetId: randomUUID() }),
      ),
    );

    expect(claims.map((claim) => claim.status)).toStrictEqual([
      "limitReached",
      "limitReached",
      "limitReached",
      "limitReached",
    ]);
  });

  it("lets a guest start their goal after a day's small AI help, and use everything else they're allowed", async () => {
    const guest = await useGuest();

    const used = (["assist", "explanation", "lessonStart", "mindMap"] as const).map((kind) => ({
      costMicros: getEstimatedCostMicros({ generated: true, kind }),
      count: { assist: 40, explanation: 5, lessonStart: 1, mindMap: 1 }[kind],
      createdAt: new Date(),
      generated: true,
      kind,
      userId: guest.id,
    }));

    await Promise.all(used.map((records) => usageRecordsFixture(records)));

    // The goal weighs the most, and still fits in the guest's day after every other use.
    await expect(claimUsage({ kind: "goal", targetId: randomUUID() })).resolves.toStrictEqual({
      status: "allowed",
    });
  });

  it("gives a guest one new mind map, while reading one that exists stays free", async () => {
    await useGuest();
    const chapterId = randomUUID();

    await expect(
      claimUsage({ generated: true, kind: "mindMap", targetId: chapterId }),
    ).resolves.toStrictEqual({ status: "allowed" });

    // Asking again for the same chapter's map, after a failed run, doesn't count twice.
    await expect(
      claimUsage({ generated: true, kind: "mindMap", targetId: chapterId }),
    ).resolves.toStrictEqual({ status: "allowed" });

    await expect(
      claimUsage({ generated: true, kind: "mindMap", targetId: randomUUID() }),
    ).resolves.toStrictEqual({
      limit: { limit: 1, period: "total", resource: "mindMap", tier: "guest" },
      status: "limitReached",
    });
  });

  it("gives a guest five quick explanations a day", async () => {
    const guest = await useGuest();

    await usageRecordsFixture({
      count: 5,
      createdAt: new Date(),
      kind: "explanation",
      userId: guest.id,
    });

    await expect(
      claimUsage({ kind: "explanation", targetId: randomUUID() }),
    ).resolves.toStrictEqual({
      limit: { limit: 5, period: "day", resource: "explanation", tier: "guest" },
      status: "limitReached",
    });
  });

  it.each([
    { day: 40, kind: "assist", month: 100 },
    { day: 5, kind: "explanation", month: 10 },
  ] as const)(
    "caps a guest's $kind at $day a day and $month a month",
    async ({ day, kind, month }) => {
      // Mid-month, so the month's earlier days are this month's.
      vi.setSystemTime(new Date(Date.UTC(2300 + Math.floor(Math.random() * 1000), 0, 15, 12)));
      const now = new Date();
      const guest = await useGuest();

      await usageRecordsFixture({ count: day, createdAt: now, kind, userId: guest.id });

      await expect(claimUsage({ kind, targetId: randomUUID() })).resolves.toStrictEqual({
        limit: { limit: day, period: "day", resource: kind, tier: "guest" },
        status: "limitReached",
      });

      const other = await useGuest();
      const earlier = new Date(now.getTime() - 10 * MS_PER_DAY);
      await usageRecordsFixture({ count: month, createdAt: earlier, kind, userId: other.id });

      await expect(claimUsage({ kind, targetId: randomUUID() })).resolves.toStrictEqual({
        limit: { limit: month, period: "month", resource: kind, tier: "guest" },
        status: "limitReached",
      });
    },
  );

  it("stops newcomers' AI work for everyone when the shared daily budget runs out", async () => {
    await prisma.newcomerSpendDay.create({
      data: { day: today(), spentMicros: NEWCOMER_DAILY_SPEND_BUDGET_MICROS },
    });

    const guest = await useGuest();

    await expect(startLesson({ generated: true })).resolves.toMatchObject({
      limit: { resource: "newcomerSpend" },
      status: "limitReached",
    });

    await expect(claimUsage({ kind: "goal", targetId: randomUUID() })).resolves.toMatchObject({
      limit: { resource: "newcomerSpend" },
      status: "limitReached",
    });

    await expect(claimUsage({ kind: "assist", targetId: randomUUID() })).resolves.toMatchObject({
      limit: { resource: "newcomerSpend" },
      status: "limitReached",
    });

    // A lesson that's already written costs no AI, so it never needs the budget.
    await expect(startLesson({ generated: false })).resolves.toStrictEqual({ status: "allowed" });
    await expect(prisma.usageRecord.count({ where: { userId: guest.id } })).resolves.toBe(1);
  });

  it("takes each use's estimated cost from the newcomers' budget, a goal weighing most", async () => {
    await useGuest();

    await claimUsage({ generated: true, kind: "explanation", targetId: randomUUID() });
    await claimUsage({ kind: "goal", targetId: randomUUID() });
    await claimUsage({ kind: "assist", targetId: randomUUID() });

    const expected = (["explanation", "goal", "assist"] as const).reduce(
      (sum, kind) => sum + getEstimatedCostMicros({ generated: true, kind }),
      0,
    );

    await expect(
      prisma.newcomerSpendDay.findUnique({ where: { day: today() } }),
    ).resolves.toMatchObject({ spentMicros: expected });

    expect(getEstimatedCostMicros({ generated: false, kind: "goal" })).toBeGreaterThan(
      getEstimatedCostMicros({ generated: true, kind: "lessonStart" }),
    );
  });

  it("tells Sentry once when newcomers pass 80% of the day's budget", async () => {
    const alertLine = NEWCOMER_DAILY_SPEND_BUDGET_MICROS * 0.8;

    await prisma.newcomerSpendDay.create({ data: { day: today(), spentMicros: alertLine - 1 } });

    await useGuest();
    await claimUsage({ kind: "assist", targetId: randomUUID() });
    await claimUsage({ kind: "assist", targetId: randomUUID() });

    expect(captureMessage).toHaveBeenCalledOnce();
  });

  it("gives a guest a day's worth of small AI help, then asks them to sign up", async () => {
    const guest = await useGuest();

    await usageRecordsFixture({
      count: 40,
      createdAt: new Date(),
      kind: "assist",
      userId: guest.id,
    });

    await expect(claimUsage({ kind: "assist", targetId: randomUUID() })).resolves.toStrictEqual({
      limit: { limit: 40, period: "day", resource: "assist", tier: "guest" },
      status: "limitReached",
    });
  });

  it("counts an account younger than a day as a newcomer, but not an older one", async () => {
    const [young, old] = await Promise.all([userFixture(), userFixture()]);

    await Promise.all([
      prisma.user.update({ data: { createdAt: new Date() }, where: { id: young.id } }),
      prisma.user.update({
        data: { createdAt: new Date(Date.now() - 2 * MS_PER_DAY) },
        where: { id: old.id },
      }),
    ]);

    await prisma.newcomerSpendDay.create({
      data: { day: today(), spentMicros: NEWCOMER_DAILY_SPEND_BUDGET_MICROS },
    });

    mockSession(young.id);

    await expect(claimUsage({ kind: "goal", targetId: randomUUID() })).resolves.toMatchObject({
      limit: { resource: "newcomerSpend", tier: "free" },
      status: "limitReached",
    });

    mockSession(old.id);

    await expect(claimUsage({ kind: "goal", targetId: randomUUID() })).resolves.toStrictEqual({
      status: "allowed",
    });
  });

  it("rate-limits guests by network and browser fingerprint, not by guest", async () => {
    const guest = await useGuest();
    vi.mocked(isRateLimited).mockResolvedValue(true);

    await expect(startLesson()).resolves.toMatchObject({ status: "slowDown" });

    expect(isRateLimited).toHaveBeenCalledWith(
      expect.objectContaining({ key: expect.stringMatching(/^network:[0-9a-f]{32}$/u) }),
    );

    expect(isRateLimited).not.toHaveBeenCalledWith(
      expect.objectContaining({ key: `user:${guest.id}` }),
    );
  });
});
