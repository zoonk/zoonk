import { logError } from "@zoonk/utils/logger";
import { prisma } from "../index";
import { seedAccounts } from "./seed/accounts";
import { seedCourseUsers } from "./seed/course-users";
import { seedOrganizations } from "./seed/orgs";
import { seedProgress } from "./seed/progress";
import { seedSubscriptions } from "./seed/subscriptions";
import { seedUsers } from "./seed/users";

async function main() {
  const users = await seedUsers(prisma);
  await seedAccounts(prisma, users);
  await seedSubscriptions(prisma, users);
  const orgs = await seedOrganizations(prisma, users);
  await seedCourseUsers(prisma, orgs.ai, users);
  await seedProgress(prisma, orgs.ai, users);
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
