import { prisma } from "@zoonk/db";
import { vi } from "vitest";
import { getUsagePeriodStarts } from "../entitlements/_utils/usage-periods";

const FIRST_ISOLATED_YEAR = 2200;
const ISOLATED_DAYS = 10_000;

/**
 * Moves the faked clock to a far-future day of its own and empties that day's budget all guests
 * share, so the spending of other tests never mixes in: a day an earlier test in the run drew,
 * and maybe filled, starts empty again.
 */
export async function useIsolatedBudgetDay(): Promise<void> {
  const offset = Math.floor(Math.random() * ISOLATED_DAYS);
  vi.setSystemTime(new Date(Date.UTC(FIRST_ISOLATED_YEAR, 0, 1 + offset, 12)));

  await prisma.guestSpendDay.deleteMany({ where: { day: getUsagePeriodStarts(new Date()).day } });
}
