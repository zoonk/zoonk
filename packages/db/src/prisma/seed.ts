import { prisma } from "../index";
import { seedContentChanges } from "./seed/content-changes";
import { seedCourses } from "./seed/courses";
import { seedOrganizations } from "./seed/organizations";
import { seedUsers } from "./seed/users";

async function main() {
  const users = await seedUsers(prisma);
  const org = await seedOrganizations(prisma, users);
  await seedCourses(prisma, org, users);
  await seedContentChanges(prisma, org, users);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
