import "server-only";
import { prisma } from "@zoonk/db";
import { cache } from "react";

const cachedGetLessonWords = cache(async (lessonId: number) =>
  prisma.lessonWord.findMany({
    include: { word: { include: { pronunciations: true } } },
    where: { lessonId },
  }),
);

/**
 * Returns all `LessonWord` records for a lesson, each including the
 * associated word (with pronunciation data). Translations live
 * on `LessonWord` itself rather than a separate `WordTranslation` table,
 * so the caller gets translation + word surface form in one object.
 */
export function getLessonWords(params: { lessonId: number }) {
  return cachedGetLessonWords(params.lessonId);
}
