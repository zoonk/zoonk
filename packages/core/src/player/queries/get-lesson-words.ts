import "server-only";
import { prisma } from "@zoonk/db";

/**
 * Player word metadata can come from one lesson or, for review, from the
 * source lessons that supplied the review steps. This helper keeps the
 * pronunciation filtering rule identical for both cases.
 */
async function listLessonWordsForLessons({ lessonIds }: { lessonIds: string[] }) {
  if (lessonIds.length === 0) {
    return [];
  }

  const firstLesson = await prisma.lessonWord.findFirst({
    select: { userLanguage: true },
    where: { lessonId: { in: lessonIds } },
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
    where: { lessonId: { in: lessonIds } },
  });
}

/**
 * Review lessons reuse steps from earlier lessons in the same chapter. The
 * player therefore needs the word translations and distractors from those
 * source lessons, not from the review lesson row itself.
 */
export function getLessonWordsForLessons(params: { lessonIds: string[] }) {
  return listLessonWordsForLessons({ lessonIds: params.lessonIds });
}
