import "server-only";
import { prisma } from "@zoonk/db";

export async function getChapterForGeneration(chapterId: number) {
  return prisma.chapter.findUnique({
    include: {
      _count: { select: { lessons: true } },
      course: true,
    },
    where: { id: chapterId },
  });
}
