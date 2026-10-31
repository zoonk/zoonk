import { randomUUID } from "node:crypto";
import { type UsageRecord, prisma } from "@zoonk/db";

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

const FIRST_TEST_ONLY_YEAR = 2100;
const FIRST_TEST_ONLY_DAY = new Date(Date.UTC(FIRST_TEST_ONLY_YEAR, 0, 1));

export async function resetGuestSpend() {
  await prisma.guestSpendDay.deleteMany({ where: { day: { lt: FIRST_TEST_ONLY_DAY } } });
}

/**
 * E2E servers never resume a past server's runs, so a call one left open never ends and keeps
 * spending the day's shared free bucket (`claimFreeCallSpend` in core).
 */
export async function clearLeftOpenLiveCalls() {
  await prisma.liveCallConnection.deleteMany({ where: { state: { not: "ended" } } });
}
