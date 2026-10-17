import { prisma } from "@zoonk/db";
import { prepareE2EData } from "./e2e-data";

/**
 * Runs before the E2E build: the build prerenders the catalog from the database and serves that
 * copy while the tests run, so the data the tests read has to be there first.
 */
await prepareE2EData();
await prisma.$disconnect();
