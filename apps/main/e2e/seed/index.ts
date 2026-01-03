import { prisma } from "@zoonk/db";
import {
  seedActivities,
  seedCategories,
  seedChapters,
  seedCourses,
  seedLessons,
  seedOrganization,
  seedSteps,
} from "./content";
import { seedCourseSuggestions } from "./course-suggestions";
import { seedCourseUsers, seedProgress } from "./enrollments";
import { seedAccounts, seedUsers } from "./users";

export async function seedE2EData(): Promise<void> {
  const users = await seedUsers(prisma);
  await seedAccounts(prisma, users);
  const org = await seedOrganization(prisma, users);
  await seedCourses(prisma, org);
  await seedChapters(prisma, org);
  await seedLessons(prisma, org);
  await seedActivities(prisma, org);
  await seedSteps(prisma, org);
  await seedCategories(prisma, org);
  await seedCourseUsers(prisma, org, users);
  await seedProgress(prisma, org, users);
  await seedCourseSuggestions(prisma);
}
