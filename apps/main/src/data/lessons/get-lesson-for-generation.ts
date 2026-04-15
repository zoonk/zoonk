import "server-only";
import { getAiGenerationLessonWhere, prisma } from "@zoonk/db";

export async function getLessonForGeneration(lessonId: number) {
  return prisma.lesson.findFirst({
    include: {
      _count: { select: { activities: true } },
      chapter: {
        include: { course: true },
      },
    },
    where: getAiGenerationLessonWhere({
      lessonWhere: { id: lessonId },
    }),
  });
}
