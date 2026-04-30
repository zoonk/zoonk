import "server-only";
import { isPrismaUniqueConstraintError, prisma } from "@zoonk/db";

/**
 * The player shell calls this as soon as a learner opens a lesson so the
 * completion write can later distinguish "started" from "never seen". Using an
 * upsert keeps repeated page visits idempotent and preserves any existing
 * completion metadata instead of resetting progress.
 */
export async function startLesson(params: { lessonId: string; userId: string }): Promise<void> {
  try {
    await prisma.lessonProgress.upsert({
      create: { lessonId: params.lessonId, userId: params.userId },
      update: {},
      where: { userLesson: { lessonId: params.lessonId, userId: params.userId } },
    });
  } catch (error) {
    if (!isPrismaUniqueConstraintError(error)) {
      throw error;
    }
  }
}
