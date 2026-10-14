import { logError } from "@zoonk/utils/logger";
import { prisma } from "../index";
import { seedAccounts } from "./seed/accounts";
import { seedLiveCalls } from "./seed/live-calls";
import { seedOrganizations } from "./seed/orgs";
import { seedProgress } from "./seed/progress";
import { seedSubscriptions } from "./seed/subscriptions";
import { seedUsers } from "./seed/users";

async function main() {
  await seedLiveCalls(prisma);
  const users = await seedUsers(prisma);
  await seedAccounts(prisma, users);
  await seedSubscriptions(prisma, users);
  await seedOrganizations(prisma, users);
  await seedProgress(prisma, users);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (error: unknown) => {
    logError(error);
    await prisma.$disconnect();
    process.exit(1);
  });
