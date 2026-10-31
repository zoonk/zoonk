import { randomUUID } from "node:crypto";
import { captureMessage } from "@sentry/nextjs";
import { prisma } from "@zoonk/db";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useIsolatedBudgetDay } from "../_test-utils/isolated-budget-day";
import { mockGuestSession, mockSession } from "../_test-utils/mock-session";
import { claimUsageForViewer } from "./_utils/claim-usage-for-viewer";
import { claimUsage } from "./claim-usage";
import { GUEST_DAILY_SPEND_BUDGET_MICROS, getEstimatedCostMicros } from "./limits";

async function useGuest() {
  const guest = await userFixture();
  await prisma.user.update({ data: { isAnonymous: true }, where: { id: guest.id } });

  mockGuestSession(guest.id);
  return guest;
}

function startLesson({ generated = false } = {}) {
  return claimUsage({ generated, kind: "lessonStart", targetId: randomUUID() });
}

function today() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

describe("guest usage", () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    await useIsolatedBudgetDay();
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

  it.each([
    { day: 40, kind: "assist", month: 100 },
    { day: 5, kind: "explanation", month: 10 },
  ] as const)(
    "caps a guest's $kind at $day a day and $month a month",
    async ({ day, kind, month }) => {
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

  it("asks a guest to create an account once the budget all guests share is spent, while an account goes on", async () => {
    await prisma.guestSpendDay.create({
      data: { day: today(), spentMicros: GUEST_DAILY_SPEND_BUDGET_MICROS },
    });

    const guest = await useGuest();
    const signUpRequired = { status: "signUpRequired" };

    await expect(startLesson({ generated: true })).resolves.toStrictEqual(signUpRequired);

    await expect(claimUsage({ kind: "goal", targetId: randomUUID() })).resolves.toStrictEqual(
      signUpRequired,
    );

    await expect(claimUsage({ kind: "assist", targetId: randomUUID() })).resolves.toStrictEqual(
      signUpRequired,
    );

    await expect(startLesson({ generated: false })).resolves.toStrictEqual({ status: "allowed" });
    await expect(prisma.usageRecord.count({ where: { userId: guest.id } })).resolves.toBe(1);

    const account = await userFixture();
    mockSession(account.id);

    await expect(claimUsage({ kind: "goal", targetId: randomUUID() })).resolves.toStrictEqual({
      status: "allowed",
    });

    await expect(claimUsage({ kind: "assist", targetId: randomUUID() })).resolves.toStrictEqual({
      status: "allowed",
    });
  });

  it("lets a guest continue once they create an account, with their usage moved to its caps", async () => {
    await prisma.guestSpendDay.create({
      data: { day: today(), spentMicros: GUEST_DAILY_SPEND_BUDGET_MICROS },
    });

    const guest = await useGuest();

    await usageRecordsFixture({
      count: 20,
      createdAt: new Date(),
      kind: "assist",
      userId: guest.id,
    });

    await expect(claimUsage({ kind: "assist", targetId: randomUUID() })).resolves.toStrictEqual({
      status: "signUpRequired",
    });

    const account = await userFixture();

    await prisma.usageRecord.updateMany({
      data: { userId: account.id },
      where: { userId: guest.id },
    });

    mockSession(account.id);

    await expect(claimUsage({ kind: "assist", targetId: randomUUID() })).resolves.toStrictEqual({
      status: "allowed",
    });

    await usageRecordsFixture({
      count: 79,
      createdAt: new Date(),
      kind: "assist",
      userId: account.id,
    });

    await expect(claimUsage({ kind: "assist", targetId: randomUUID() })).resolves.toMatchObject({
      limit: { limit: 100, period: "day", resource: "assist", tier: "free" },
      status: "limitReached",
    });
  });

  it("takes each guest use's estimated cost from the budget all guests share, a goal weighing most", async () => {
    await useGuest();

    await claimUsage({ generated: true, kind: "explanation", targetId: randomUUID() });
    await claimUsage({ kind: "goal", targetId: randomUUID() });
    await claimUsage({ kind: "assist", targetId: randomUUID() });

    await expect(
      prisma.guestSpendDay.findUnique({ where: { day: today() } }),
    ).resolves.toMatchObject({ spentMicros: 1_825_000 });
  });

  it("never refuses a guest because the day's budget row was cleared while they claimed", async () => {
    const guests = await Promise.all(Array.from({ length: 20 }, () => userFixture()));
    const now = new Date();
    const claiming = new AbortController();

    const clear = (async () => {
      while (!claiming.signal.aborted) {
        // oxlint-disable-next-line no-await-in-loop -- Each clear waits for the one before.
        await prisma.guestSpendDay.deleteMany({ where: { day: today() } });
      }
    })();

    const decisions = await Promise.all(
      guests.map((guest) =>
        claimUsageForViewer({
          generated: false,
          kind: "assist",
          now,
          targetId: randomUUID(),
          viewer: { isGuest: true, tier: "guest", userId: guest.id },
        }),
      ),
    );

    claiming.abort();
    await clear;

    expect(decisions.map((decision) => decision.status)).toStrictEqual(guests.map(() => "allowed"));
  });

  it("tells Sentry once when guests pass 80% of the day's budget", async () => {
    const alertLine = GUEST_DAILY_SPEND_BUDGET_MICROS * 0.8;

    await prisma.guestSpendDay.create({ data: { day: today(), spentMicros: alertLine - 1 } });

    await useGuest();
    await claimUsage({ kind: "assist", targetId: randomUUID() });
    await claimUsage({ kind: "assist", targetId: randomUUID() });

    expect(captureMessage).toHaveBeenCalledOnce();
  });
});
