import "server-only";
import { getAiGenerationLessonWhere, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";

/**
 * Generate routes call `notFound()` when this lookup returns `null`. We treat
 * malformed ids the same way so bad route params do not bubble up as Prisma
 * UUID parsing errors.
 */
export async function getLessonForGeneration(lessonId: string) {
  if (!isUuid(lessonId)) {
    return null;
  }

  return prisma.lesson.findFirst({
    include: {
      _count: { select: { steps: true } },
      chapter: {
        include: { course: true },
      },
    },
    where: getAiGenerationLessonWhere({
      lessonWhere: { id: lessonId },
    }),
  });
}
