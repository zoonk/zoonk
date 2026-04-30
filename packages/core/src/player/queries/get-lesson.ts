import "server-only";
import { getPublishedLessonWhere, getPublishedStepWhere, prisma } from "@zoonk/db";
import { cache } from "react";

const cachedGetLesson = cache(async (lessonId: string) =>
  prisma.lesson.findFirst({
    include: {
      steps: {
        include: { sentence: true, word: true },
        orderBy: { position: "asc" },
        where: getPublishedStepWhere(),
      },
    },
    where: getPublishedLessonWhere({
      lessonWhere: { id: lessonId },
    }),
  }),
);

export function getLesson(params: { lessonId: string }) {
  return cachedGetLesson(params.lessonId);
}
