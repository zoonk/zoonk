import {
  getChapterLessonsCacheTag,
  getLessonCacheTag,
  getUserProgressCacheTag,
} from "@/data/cache-tags";
import { getSession } from "@/data/users/get-session";
import {
  type PreparePlayerLessonInput,
  preparePlayerLessonData,
} from "@zoonk/core/player/contracts/prepare-lesson-data";
import { getChapterDistractorWordsForResources } from "@zoonk/core/player/queries/get-chapter-distractor-words";
import { getChapterSentenceWords } from "@zoonk/core/player/queries/get-chapter-sentence-words";
import { getChapterSentencesForIds } from "@zoonk/core/player/queries/get-chapter-sentences";
import { getChapterWordsForIds } from "@zoonk/core/player/queries/get-chapter-words";
import { getLesson } from "@zoonk/core/player/queries/get-lesson";
import { type ReviewStep, getReviewSteps } from "@zoonk/core/player/queries/get-review-steps";
import { prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";

type ReviewLessonData = { generationLessonId: string | null; steps: ReviewStep[] };

/**
 * Caches the public playable lesson at the main-app boundary so the reusable
 * core query stays independent of framework cache policy.
 */
export async function getPlayerLesson(lessonId: string) {
  "use cache";
  cacheTag(getLessonCacheTag(lessonId));

  return getLesson(lessonId);
}

/**
 * Loads each base chapter resource once, then derives both dependent word banks
 * in a second parallel wave. This avoids the duplicate reads previously hidden
 * by package-level React cache calls.
 */
export async function getPlayerResources(input: {
  chapterSentenceIds: string[];
  chapterWordIds: string[];
  lessonId: string;
}) {
  "use cache";
  cacheTag(getLessonCacheTag(input.lessonId));

  const [chapterWords, chapterSentences] = await Promise.all([
    getChapterWordsForIds(input.chapterWordIds),
    getChapterSentencesForIds(input.chapterSentenceIds),
  ]);

  const [distractorWords, sentenceWords] = await Promise.all([
    getChapterDistractorWordsForResources({ chapterSentences, chapterWords }),
    getChapterSentenceWords(chapterSentences),
  ]);

  return { chapterSentences, chapterWords, distractorWords, sentenceWords };
}

/**
 * Keeps the player's server-side shuffle private to this browser while letting
 * runtime prefetching prepare the complete lesson before navigation.
 */
export async function preparePlayerLesson(input: PreparePlayerLessonInput) {
  "use cache: private";

  return preparePlayerLessonData(input);
}

/**
 * Finds the first earlier generated lesson that still needs content before a
 * review lesson can have anything useful to replay.
 */
async function getFirstIncompleteGeneratedLessonBeforeReview({
  chapterId,
  position,
}: {
  chapterId: string;
  position: number;
}) {
  "use cache";

  cacheTag(getChapterLessonsCacheTag(chapterId));

  return prisma.lesson.findFirst({
    orderBy: { position: "asc" },
    where: {
      chapterId,
      generationStatus: { not: "completed" },
      isPublished: true,
      kind: { notIn: ["custom", "review"] },
      position: { lt: position },
    },
  });
}

async function findReviewSteps({
  chapterId,
  userId,
}: {
  chapterId: string;
  userId: string | null;
}) {
  "use cache";

  cacheTag(getChapterLessonsCacheTag(chapterId));

  if (userId) {
    cacheTag(getUserProgressCacheTag(userId));
  }

  return getReviewSteps({ chapterId, userId });
}

/**
 * Review lessons do not own generated steps, so the page needs both the dynamic
 * review steps and a fallback generation target when those steps are empty.
 */
export async function fetchReviewLessonData(lessonId: string): Promise<ReviewLessonData | null> {
  const [lesson, session] = await Promise.all([getPlayerLesson(lessonId), getSession()]);

  if (lesson?.kind !== "review") {
    return null;
  }

  const [steps, generationLesson] = await Promise.all([
    findReviewSteps({ chapterId: lesson.chapterId, userId: session?.user.id ?? null }),
    getFirstIncompleteGeneratedLessonBeforeReview({
      chapterId: lesson.chapterId,
      position: lesson.position,
    }),
  ]);

  return { generationLessonId: generationLesson?.id ?? null, steps };
}
