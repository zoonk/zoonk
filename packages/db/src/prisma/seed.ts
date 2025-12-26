import { prisma } from "../index";
import { seedChapters } from "./seed/chapters";
import { seedCourses } from "./seed/courses";
import { seedOrganizations } from "./seed/orgs";
import { seedUsers } from "./seed/users";

async function main() {
  const users = await seedUsers(prisma);
  const org = await seedOrganizations(prisma, users);
  await seedCourses(prisma, org);
  await seedChapters(prisma, org);
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
