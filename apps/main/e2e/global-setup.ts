import { prisma } from "@zoonk/db";
import { resetGuestSpend } from "@zoonk/testing/fixtures/usage";
import { prepareE2EData } from "./e2e-data";

/**
 * The database may be newer than a build restored from a cache, so the data is prepared again.
 * `pnpm e2e:main` prepared it moments before (`E2E_DATA_PREPARED`), so its runs only clear the budget.
 */
export default async function globalSetup(): Promise<void> {
  await (process.env.E2E_DATA_PREPARED === "true" ? resetGuestSpend() : prepareE2EData());
  await prisma.$disconnect();
}
