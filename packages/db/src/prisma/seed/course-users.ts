import type { Organization, PrismaClient } from "../../generated/prisma/client";
import type { SeedUsers } from "./users";

export async function seedCourseUsers(
  prisma: PrismaClient,
  org: Organization,
  users: SeedUsers,
): Promise<void> {
  const courses = await prisma.course.findMany({
    where: { isPublished: true, organizationId: org.id },
  });

  if (courses.length === 0) {
    return;
  }

  const firstCourse = courses[0];
  const secondCourse = courses[1];

  if (firstCourse) {
    await prisma.courseUser.upsert({
      create: {
        courseId: firstCourse.id,
        userId: users.owner.id,
      },
      update: {},
      where: {
        courseUser: {
          courseId: firstCourse.id,
          userId: users.owner.id,
        },
      },
    });

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

  if (secondCourse) {
    await prisma.courseUser.upsert({
      create: {
        courseId: secondCourse.id,
        userId: users.owner.id,
      },
      update: {},
      where: {
        courseUser: {
          courseId: secondCourse.id,
          userId: users.owner.id,
        },
      },
    });
  }
}
