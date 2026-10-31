import { prisma } from "@zoonk/db";
import { prepareE2EData } from "./e2e-data";

await prepareE2EData();
await prisma.$disconnect();
// oxlint-disable-next-line unicorn/no-process-exit -- The database pool's idle connections keep this script alive about 10 s after the data is written, holding the build back, as in core's seed scripts.
process.exit(0);
