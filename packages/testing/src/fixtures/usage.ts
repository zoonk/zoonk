import { randomUUID } from "node:crypto";
import { type UsageRecord, prisma } from "@zoonk/db";

/**
 * Records `count` metered uses (lesson starts unless `kind` says otherwise), each with its own
 * target, so a test can put a learner right at a limit.
 */
export async function usageRecordsFixture({
  count,
  ...attrs
}: Partial<Omit<UsageRecord, "targetId">> & Pick<UsageRecord, "userId"> & { count: number }) {
  await prisma.usageRecord.createMany({
    data: Array.from({ length: count }, () => ({
      kind: "lessonStart" as const,
      ...attrs,
      targetId: randomUUID(),
    })),
  });
}

/** Budget tests use days from this far-future year on, so a reset never touches them. */
const FIRST_TEST_ONLY_YEAR = 2100;
const FIRST_TEST_ONLY_DAY = new Date(Date.UTC(FIRST_TEST_ONLY_YEAR, 0, 1));

/**
 * Clears the AI budget all guests share for real days, so a day of test runs with guests never
 * spends it and refuses later tests' claims.
 */
export async function resetGuestSpend() {
  await prisma.guestSpendDay.deleteMany({ where: { day: { lt: FIRST_TEST_ONLY_DAY } } });
}

/**
 * Clears live calls a past run left open: each E2E run has its own workflow store, so their
 * deadline runs stopped with that run's server, and open calls of a few learners at once pause
 * calls for everyone (`isLiveCallCleanupHealthy` in core).
 */
export async function clearLeftOpenLiveCalls() {
  await prisma.liveCallConnection.deleteMany({ where: { state: { not: "closed" } } });
}
