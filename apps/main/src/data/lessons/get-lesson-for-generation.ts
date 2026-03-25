import "server-only";
import { prisma } from "@zoonk/db";

export async function getLessonForGeneration(lessonId: number) {
  return prisma.lesson.findUnique({
    include: {
      _count: { select: { activities: true } },
      chapter: {
        include: { course: true },
      },
    },
    where: { id: lessonId },
  });
}
