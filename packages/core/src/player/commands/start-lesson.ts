import "server-only";
import { prisma } from "@zoonk/db";

/**
 * Concurrent page loads can try to create the same progress row at the same
 * time. Prisma upsert can still surface the database unique violation from
 * that race, so this helper keeps the command idempotent by recognizing that
 * specific already-created result.
 */
function isUniqueConstraintError(error: unknown) {
  return error instanceof Error && "code" in error && error.code === "P2002";
}

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
    if (!isUniqueConstraintError(error)) {
      throw error;
    }
  }
}
