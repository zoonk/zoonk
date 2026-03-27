import "server-only";
import { prisma } from "@zoonk/db";
import { cache } from "react";

const cachedGetLessonSentences = cache(async (lessonId: number) =>
  prisma.lessonSentence.findMany({
    include: { sentence: true },
    where: { lessonId },
  }),
);

/**
 * Returns all `LessonSentence` records for a lesson, each including
 * the associated sentence. Translations now live on `LessonSentence`
 * itself rather than a separate `SentenceTranslation` table, so the
 * caller gets translation + sentence surface form in one object.
 */
export function getLessonSentences(params: { lessonId: number }) {
  return cachedGetLessonSentences(params.lessonId);
}
