import { type Organization, type PrismaClient } from "../../generated/prisma/client";
import { type SeedUsers } from "./users";

export async function seedCourseUsers(
  prisma: PrismaClient,
  org: Organization,
  users: SeedUsers,
): Promise<void> {
  const courses = await prisma.course.findMany({
    orderBy: { id: "asc" },
    take: 5,
    where: { isPublished: true, language: "en", organizationId: org.id },
  });

  if (courses.length === 0) {
    return;
  }

  // Enroll owner in all 5 courses with different startedAt times
  // So they appear in order in the continue learning section
  const now = new Date();
  await Promise.all(
    courses.map((course, index) =>
      prisma.courseUser.upsert({
        create: {
          courseId: course.id,
          startedAt: new Date(now.getTime() - index * 60 * 60 * 1000), // Each course started 1 hour earlier
          userId: users.owner.id,
        },
        update: {},
        where: {
          courseUser: {
            courseId: course.id,
            userId: users.owner.id,
          },
        },
      }),
    ),
  );

  // Also enroll member in the first course
  const firstCourse = courses[0];
  if (firstCourse) {
    await prisma.courseUser.upsert({
      create: {
        courseId: firstCourse.id,
        userId: users.member.id,
      },
      update: {},
      where: {
        courseUser: {
          courseId: firstCourse.id,
          userId: users.member.id,
        },
      },
    });
  }

  // Sync userCount for all enrolled courses
  await Promise.all(
    courses.map(async (course) => {
      const count = await prisma.courseUser.count({ where: { courseId: course.id } });
      await prisma.course.update({
        data: { userCount: count },
        where: { id: course.id },
      });
    }),
  );
}
