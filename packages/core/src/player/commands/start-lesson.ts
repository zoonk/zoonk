import "server-only";
import { isPrismaUniqueConstraintError, prisma } from "@zoonk/db";
import { enrollUserInCourse } from "../../courses/enroll-user-in-course";
import { getSession } from "../../users/get-user-session";

/**
 * Records that the current learner started a lesson and enrolls them in its
 * course. Both writes are idempotent because lesson starts can be repeated or
 * concurrent, while the session-derived user id keeps both operations scoped to
 * the current learner.
 */
export async function startLesson(lessonId: string): Promise<void> {
  const session = await getSession();

  if (!session) {
    return;
  }

  const userId = session.user.id;

  try {
    const lesson = await prisma.lesson.findUniqueOrThrow({
      include: { chapter: true },
      where: { id: lessonId },
    });

    await Promise.all([
      prisma.lessonProgress.upsert({
        create: { lessonId, userId },
        update: {},
        where: { userLesson: { lessonId, userId } },
      }),
      enrollUserInCourse({ courseId: lesson.chapter.courseId, userId }),
    ]);
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      return;
    }

    throw error;
  }
}
