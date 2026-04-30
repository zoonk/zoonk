import "server-only";
import { prisma } from "@zoonk/db";

/**
 * Sentence metadata is read by both normal lessons and review lessons. Review
 * lessons need the sentence rows from whichever source lessons supplied the
 * on-demand review steps.
 */
async function listLessonSentencesForLessons({ lessonIds }: { lessonIds: string[] }) {
  if (lessonIds.length === 0) {
    return [];
  }

  return prisma.lessonSentence.findMany({
    include: { sentence: true },
    where: { lessonId: { in: lessonIds } },
  });
}

/**
 * Fetches sentence metadata for a set of lessons so review payloads can render
 * source lesson reading and listening steps with the right translations.
 */
export function getLessonSentencesForLessons(params: { lessonIds: string[] }) {
  return listLessonSentencesForLessons({ lessonIds: params.lessonIds });
}
