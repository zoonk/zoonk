import "server-only";
import { isPrismaUniqueConstraintError, prisma } from "@zoonk/db";
import { getSession } from "../../users/get-user-session";

/**
 * The player shell calls this as soon as a learner opens a lesson so the
 * completion write can later distinguish "started" from "never seen". A
 * session-derived user id keeps this analytics write scoped to the current
 * learner, while the upsert preserves existing progress on repeat visits.
 */
export async function startLesson(lessonId: string): Promise<void> {
  const session = await getSession();

  if (!session) {
    return;
  }

  try {
    await prisma.lessonProgress.upsert({
      create: { lessonId, userId: session.user.id },
      update: {},
      where: { userLesson: { lessonId, userId: session.user.id } },
    });
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      return;
    }

    throw error;
  }
}
