import "server-only";
import { prisma } from "@zoonk/db";
import { cache } from "react";

const cachedGetLessonWords = cache(async (lessonId: string) => {
  const firstLesson = await prisma.lessonWord.findFirst({
    select: { userLanguage: true },
    where: { lessonId },
  });

  if (!firstLesson) {
    return [];
  }

  return prisma.lessonWord.findMany({
    include: {
      word: {
        include: {
          pronunciations: { where: { userLanguage: firstLesson.userLanguage } },
        },
      },
    },
    where: { lessonId },
  });
});

/**
 * Returns all `LessonWord` records for a lesson, each including the
 * associated word with pronunciation filtered by the lesson's user
 * language. Translations live on `LessonWord` itself rather than a
 * separate `WordTranslation` table, so the caller gets translation +
 * word surface form in one object.
 */
export function getLessonWords(params: { lessonId: string }) {
  return cachedGetLessonWords(params.lessonId);
}
