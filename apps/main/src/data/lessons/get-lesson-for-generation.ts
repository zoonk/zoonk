import "server-only";
import { prisma } from "@zoonk/db";

export async function getLessonForGeneration(lessonId: number) {
  return prisma.lesson.findUnique({
    select: {
      chapter: {
        select: {
          course: { select: { slug: true } },
          slug: true,
        },
      },
      description: true,
      generationRunId: true,
      generationStatus: true,
      id: true,
      slug: true,
      title: true,
    },
    where: { id: lessonId },
  });
}
