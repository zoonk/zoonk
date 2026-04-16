import "server-only";
import { getAiGenerationChapterWhere, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";

/**
 * Generate routes expect missing chapters to resolve to a 404. Returning `null`
 * for malformed ids preserves that behavior instead of surfacing a Prisma UUID
 * parsing error from the URL.
 */
export async function getChapterForGeneration(chapterId: string) {
  if (!isUuid(chapterId)) {
    return null;
  }

  return prisma.chapter.findFirst({
    include: {
      _count: { select: { lessons: true } },
      course: true,
    },
    where: getAiGenerationChapterWhere({
      chapterWhere: { id: chapterId },
    }),
  });
}
