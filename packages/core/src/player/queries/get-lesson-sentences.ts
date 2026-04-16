import "server-only";
import { prisma } from "@zoonk/db";
import { cache } from "react";

const cachedGetLessonSentences = cache(async (lessonId: string) =>
  prisma.lessonSentence.findMany({
    include: { sentence: true },
    where: { lessonId },
  }),
);

/**
 * Returns all `LessonSentence` records for a lesson, each including
 * the canonical sentence row used for audio and romanization.
 */
export function getLessonSentences(params: { lessonId: string }) {
  return cachedGetLessonSentences(params.lessonId);
}
