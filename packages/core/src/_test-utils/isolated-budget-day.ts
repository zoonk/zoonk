import { prisma } from "@zoonk/db";
import { vi } from "vitest";
import { getUsagePeriodStarts } from "../entitlements/_utils/usage-periods";

const FIRST_ISOLATED_YEAR = 2200;
const ISOLATED_DAYS = 10_000;

export async function useIsolatedBudgetDay(): Promise<void> {
  const offset = Math.floor(Math.random() * ISOLATED_DAYS);
  vi.setSystemTime(new Date(Date.UTC(FIRST_ISOLATED_YEAR, 0, 1 + offset, 12)));

  await prisma.guestSpendDay.deleteMany({ where: { day: getUsagePeriodStarts(new Date()).day } });
}
