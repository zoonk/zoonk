import { getAiGenerationLessonWhere, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";

/**
 * Loads the AI-owned lesson that can be resumed by a generation workflow.
 * Malformed and inaccessible ids return `null` so every delivery app applies
 * the same generation boundary without exposing Prisma UUID parsing errors.
 */
export async function getLessonForGeneration(lessonId: string) {
  if (!isUuid(lessonId)) {
    return null;
  }

  return prisma.lesson.findFirst({
    include: { _count: { select: { steps: true } }, chapter: { include: { course: true } } },
    where: getAiGenerationLessonWhere({ lessonWhere: { id: lessonId } }),
  });
}
