import {
  type LessonGetPayload,
  getPublishedLessonWhere,
  getPublishedStepWhere,
  prisma,
} from "@zoonk/db";

export type PlayerLesson = LessonGetPayload<{
  include: { chapter: true; steps: { include: { sentence: true; word: true } } };
}>;

/**
 * Loads a published lesson together with only the published steps the player
 * can render, preserving their generated order and attached resources.
 */
export function getLesson(lessonId: string): Promise<PlayerLesson | null> {
  return prisma.lesson.findFirst({
    include: {
      chapter: true,
      steps: {
        include: { sentence: true, word: true },
        orderBy: { position: "asc" },
        where: getPublishedStepWhere(),
      },
    },
    where: getPublishedLessonWhere({ lessonWhere: { id: lessonId } }),
  });
}
