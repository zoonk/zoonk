import "server-only";

import { prisma } from "@zoonk/db";

export async function getChapterForGeneration(chapterId: number) {
  return prisma.chapter.findUnique({
    select: {
      _count: {
        select: {
          lessons: true,
        },
      },
      course: {
        select: {
          slug: true,
          title: true,
        },
      },
      description: true,
      generationRunId: true,
      generationStatus: true,
      id: true,
      language: true,
      organizationId: true,
      title: true,
    },
    where: { id: chapterId },
  });
}
