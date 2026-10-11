import { prisma } from "@zoonk/db";
import { prepareE2EData } from "./e2e-data";

/**
 * Prepares the structural data browser tests read (see `prepareE2EData`) and clears the AI budget
 * guests share, which every run's test guests would otherwise spend. The E2E build prepared it once
 * already (it prerenders the catalog from the database); this run's database may be newer than a
 * build restored from a cache.
 */
export default async function globalSetup(): Promise<void> {
  await prepareE2EData();
  await prisma.$disconnect();
}
