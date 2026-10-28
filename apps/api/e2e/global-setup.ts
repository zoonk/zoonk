import { prisma } from "@zoonk/db";
import { clearLeftOpenLiveCalls, resetGuestSpend } from "@zoonk/testing/fixtures/usage";

/** Clears the AI budget guests share, which every run's test guests would spend. */
export default async function globalSetup(): Promise<void> {
  await Promise.all([
    resetGuestSpend(),
    // Admission is explicit in E2E; production defaults safely to paused.
    prisma.liveCallSetting.upsert({
      create: { admission: "all", freeDailyBudgetMicros: 100_000_000, id: "live" },
      update: { admission: "all", freeDailyBudgetMicros: 100_000_000 },
      where: { id: "live" },
    }),
    prisma.freeCallSpendDay.deleteMany(),
    clearLeftOpenLiveCalls(),
  ]);

  await prisma.$disconnect();
}
