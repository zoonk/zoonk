import { prisma } from "@zoonk/db";
import { resetGuestSpend } from "@zoonk/testing/fixtures/usage";
import { prepareE2EData } from "./e2e-data";

/**
 * Prepares the structural data browser tests read (see `prepareE2EData`) and clears the AI budget
 * guests share, which every run's test guests would otherwise spend. The E2E build prepared it once
 * already (it prerenders the catalog from the database); this run's database may be newer than a
 * build restored from a cache. `pnpm e2e:main` builds Main from data it prepared moments before
 * (`E2E_DATA_PREPARED`), so its runs only clear the budget.
 */
export default async function globalSetup(): Promise<void> {
  await (process.env.E2E_DATA_PREPARED === "true" ? resetGuestSpend() : prepareE2EData());
  await prisma.$disconnect();
}
