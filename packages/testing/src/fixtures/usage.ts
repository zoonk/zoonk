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
 * Clears the AI budget all newcomers share for real days. Every test account is younger than a
 * day, so without this a day of test runs would spend the budget and refuse later tests' claims.
 */
export async function resetNewcomerSpend() {
  await prisma.newcomerSpendDay.deleteMany({ where: { day: { lt: FIRST_TEST_ONLY_DAY } } });
}
