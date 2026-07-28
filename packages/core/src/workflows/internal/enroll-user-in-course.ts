import { prisma } from "@zoonk/db";

/**
 * Keeps course membership and the catalog popularity count in sync. Lesson
 * starts and course generation can race or retry, so this operation owns the
 * transaction that creates the unique CourseUser row and increments the
 * course's user count exactly once.
 *
 * This internal workflow bridge accepts a user ID only because the public core
 * generation-access boundary derives it from the authenticated request before
 * serializing the workflow input. It is not an app authorization boundary.
 */
export async function enrollUserInCourse({
  courseId,
  userId,
}: {
  courseId: string;
  userId: string;
}): Promise<void> {
  await prisma.$transaction(async (transaction) => {
    const { count } = await transaction.courseUser.createMany({
      data: [{ courseId, userId }],
      skipDuplicates: true,
    });

    if (count === 0) {
      return;
    }

    await transaction.course.update({
      data: { userCount: { increment: 1 } },
      where: { id: courseId },
    });
  });
}
