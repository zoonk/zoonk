import "server-only";
import { prisma } from "@zoonk/db";

export async function getLessonForGeneration(lessonId: number) {
  return prisma.lesson.findUnique({
    include: {
      chapter: {
        include: { course: true },
      },
    },
    where: { id: lessonId },
  });
}
