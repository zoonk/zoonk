import "server-only";
import { getAiGenerationChapterWhere, prisma } from "@zoonk/db";

export async function getChapterForGeneration(chapterId: number) {
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
