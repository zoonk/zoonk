import { logError } from "@zoonk/utils/logger";
import { prisma } from "../index";
import { seedAccounts } from "./seed/accounts";
import { seedOrganizations } from "./seed/orgs";
import { seedProgress } from "./seed/progress";
import { seedSubscriptions } from "./seed/subscriptions";
import { seedUsers } from "./seed/users";
import { seedV2 } from "./seed/v2";

async function main() {
  const users = await seedUsers(prisma);
  await seedAccounts(prisma, users);
  await seedSubscriptions(prisma, users);
  await seedOrganizations(prisma, users);
  await seedProgress(prisma, users);
  await seedV2(prisma);
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
