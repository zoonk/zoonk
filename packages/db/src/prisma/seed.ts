import { prisma } from "../index";
import { seedAccounts } from "./seed/accounts";
import { seedActivities } from "./seed/activities";
import { seedAlternativeTitles } from "./seed/alternative-titles";
import { seedCategories } from "./seed/categories";
import { seedChapters } from "./seed/chapters";
import { seedCourseSuggestions } from "./seed/course-suggestions";
import { seedCourseUsers } from "./seed/course-users";
import { seedCourses } from "./seed/courses";
import { seedLessons } from "./seed/lessons";
import { seedOrganizations } from "./seed/orgs";
import { seedProgress } from "./seed/progress";
import { seedSentences } from "./seed/sentences";
import { seedSteps } from "./seed/steps";
import { seedUsers } from "./seed/users";
import { seedWords } from "./seed/words";

async function main() {
  const users = await seedUsers(prisma);
  await seedAccounts(prisma, users);
  const orgs = await seedOrganizations(prisma, users);
  await seedCourses(prisma, orgs);
  await seedCategories(prisma, orgs.ai);
  await seedChapters(prisma, orgs.ai);
  await seedLessons(prisma, orgs.ai);
  await seedWords(prisma, orgs.ai);
  await seedSentences(prisma, orgs.ai);
  await seedAlternativeTitles(prisma, orgs.ai);
  await seedCourseUsers(prisma, orgs.ai, users);
  await seedActivities(prisma, orgs.ai);
  await seedSteps(prisma, orgs.ai);
  await seedProgress(prisma, orgs.ai, users);
  await seedCourseSuggestions(prisma);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
