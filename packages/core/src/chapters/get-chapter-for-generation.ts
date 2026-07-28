import { getAiGenerationChapterWhere, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";

/**
 * Loads the AI-owned chapter that can be resumed by a generation workflow.
 * Malformed and inaccessible ids return `null` so every delivery app applies
 * the same generation boundary without exposing Prisma UUID parsing errors.
 */
export async function getChapterForGeneration(chapterId: string) {
  if (!isUuid(chapterId)) {
    return null;
  }

  return prisma.chapter.findFirst({
    include: { _count: { select: { lessons: true } }, course: true },
    where: getAiGenerationChapterWhere({ chapterWhere: { id: chapterId } }),
  });
}
