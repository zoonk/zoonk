import { prisma } from "@zoonk/db";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { seedV2 } from "@zoonk/e2e/fixtures/seed-v2";
import { clearLeftOpenLiveCalls, resetGuestSpend } from "@zoonk/testing/fixtures/usage";

/**
 * The structural data browser tests read: the v2 seed (the Library courses and one persona per
 * goal kind, `v2-*@zoonk.test`) and the AI organization. It runs before the E2E build, because the
 * build prerenders the catalog from the database and serves that copy while the tests run, and
 * again before the tests, which also clears the AI budget guests share.
 */
export async function prepareE2EData(): Promise<void> {
  await seedV2();

  await Promise.all([
    getAiOrganization(),
    resetGuestSpend(),
    clearLeftOpenLiveCalls(),
    prisma.liveCallSetting.upsert({
      create: { admission: "all", freeDailyBudgetMicros: 100_000_000, id: "live" },
      update: { admission: "all", freeDailyBudgetMicros: 100_000_000 },
      where: { id: "live" },
    }),
  ]);
}
