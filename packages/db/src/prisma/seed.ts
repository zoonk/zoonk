import { prisma } from "../index";
import { seedAccounts } from "./seed/accounts";
import { seedActivities } from "./seed/activities";
import { seedAlternativeTitles } from "./seed/alternative-titles";
import { seedCategories } from "./seed/categories";
import { seedChapters } from "./seed/chapters";
import { seedCourseUsers } from "./seed/course-users";
import { seedCourses } from "./seed/courses";
import { seedLessons } from "./seed/lessons";
import { seedOrganizations } from "./seed/orgs";
import { seedProgress } from "./seed/progress";
import { seedSteps } from "./seed/steps";
import { seedUsers } from "./seed/users";

async function main() {
  const users = await seedUsers(prisma);
  await seedAccounts(prisma, users);
  const org = await seedOrganizations(prisma, users);
  await seedCourses(prisma, org);
  await seedCategories(prisma, org);
  await seedChapters(prisma, org);
  await seedLessons(prisma, org);
  await seedAlternativeTitles(prisma, org);
  await seedCourseUsers(prisma, org, users);
  await seedActivities(prisma, org);
  await seedSteps(prisma, org);
  await seedProgress(prisma, org, users);
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
