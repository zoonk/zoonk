import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { cacheTag } from "next/cache";
import { hasActiveSubscription } from "../../auth/subscription";
import {
  getChapterLessonsCacheTag,
  getLessonCacheTag,
  getUserProgressCacheTag,
} from "../../cache/tags";
import { getLessonAccessRequirement } from "../../lessons/access";
import { isStandaloneGeneratedLessonKind } from "../../lessons/generated-companion-kinds";
import {
  getSourceLessonForGeneratedCompanion,
  isGeneratedCompanionLessonKind,
} from "../../lessons/generated-companions";
import { getLessonForGeneration } from "../../lessons/get-lesson-for-generation";
import { getReadableLessonWhere } from "../../lessons/read-access";
import { getSession } from "../../users/get-session";
import {
  type PreparePlayerLessonInput,
  preparePlayerLessonData,
} from "../contracts/prepare-lesson-data";
import { getChapterDistractorWordsForResources } from "./get-chapter-distractor-words";
import { getChapterSentenceWords } from "./get-chapter-sentence-words";
import { getChapterSentencesForIds } from "./get-chapter-sentences";
import { getChapterWordsForIds } from "./get-chapter-words";
import { type PlayerLesson, getLesson } from "./get-lesson";
import { getPlayerResourceIds } from "./get-player-resource-ids";
import { type ReviewStep, getReviewSteps } from "./get-review-steps";

/**
 * Identifies the AI generation resource that can make one pending public
 * lesson playable. Delivery apps map this route-neutral target to their own
 * navigation without repeating AI ownership or companion-source queries.
 */
async function getNotGeneratedLessonTarget(lesson: PlayerLesson) {
  const generationLesson = await getLessonForGeneration(lesson.id);

  if (!generationLesson) {
    return null;
  }

  if (isStandaloneGeneratedLessonKind(generationLesson.kind)) {
    return { kind: "lesson" as const, lessonId: generationLesson.id };
  }

  if (!isGeneratedCompanionLessonKind(generationLesson.kind)) {
    return null;
  }

  const sourceLesson = await getSourceLessonForGeneratedCompanion({
    chapterId: generationLesson.chapterId,
    lessonId: generationLesson.id,
  });

  return sourceLesson
    ? { kind: "sourceLesson" as const, lessonId: sourceLesson.id, lessonSlug: sourceLesson.slug }
    : null;
}

/**
 * Finds the first earlier generated lesson that still needs content before a
 * review lesson can offer meaningful practice.
 */
async function getReviewGenerationLessonId({
  chapterId,
  position,
}: {
  chapterId: string;
  position: number;
}) {
  const lesson = await prisma.lesson.findFirst({
    orderBy: { position: "asc" },
    where: {
      chapterId,
      generationStatus: { not: "completed" },
      isPublished: true,
      kind: { notIn: ["custom", "review"] },
      position: { lt: position },
    },
  });

  return lesson?.id ?? null;
}

/**
 * Review lessons select personalized steps on demand and independently resolve
 * the generation fallback used when no reviewable steps exist.
 */
async function getReviewLessonData({
  chapterId,
  position,
  userId,
}: {
  chapterId: string;
  position: number;
  userId: string | null;
}) {
  const [generationLessonId, steps] = await Promise.all([
    getReviewGenerationLessonId({ chapterId, position }),
    getReviewSteps({ chapterId, userId }),
  ]);

  return { generationLessonId, steps };
}

/**
 * Loads base chapter resources once and derives both dependent word banks in a
 * second parallel wave.
 */
async function getPlayableLessonResources(steps: ReviewStep[]) {
  const resourceIds = getPlayerResourceIds({ steps });

  const [chapterSentences, chapterWords] = await Promise.all([
    getChapterSentencesForIds(resourceIds.chapterSentenceIds),
    getChapterWordsForIds(resourceIds.chapterWordIds),
  ]);

  const [distractorWords, sentenceWords] = await Promise.all([
    getChapterDistractorWordsForResources({ chapterSentences, chapterWords }),
    getChapterSentenceWords(chapterSentences),
  ]);

  return { chapterSentences, chapterWords, distractorWords, sentenceWords };
}

/**
 * Resolves the inexpensive authorization decision before the player loads steps
 * and related resources. Main calls this leaf before starting its parallel
 * player reads, while `getLessonContent` calls the same private-cache leaf so
 * API consumers cannot bypass the check and same-tree calls are deduplicated.
 */
export async function getLessonContentAccess(lessonId: string) {
  "use cache: private";

  if (!isUuid(lessonId)) {
    return { status: "unavailable" as const };
  }

  const session = await getSession();

  const lesson = await prisma.lesson.findFirst({
    include: { chapter: true },
    where: getReadableLessonWhere({ lessonId, userId: session?.user.id ?? null }),
  });

  cacheTag(getLessonCacheTag(lessonId));

  if (!lesson) {
    return { status: "unavailable" as const };
  }

  if (getLessonAccessRequirement({ lesson }) !== "subscription") {
    return { status: "allowed" as const };
  }

  const hasSubscription = await hasActiveSubscription();

  if (session) {
    cacheTag(getUserProgressCacheTag(session.user.id));
  }

  if (!hasSubscription) {
    return { status: "subscriptionRequired" as const };
  }

  return { status: "allowed" as const };
}

/**
 * Resolves one presentation-neutral playable lesson outcome. Core owns
 * publication, subscription access, generation state, review selection, and
 * player resource hydration; routes remain responsible for navigation, copy,
 * progress composition, and serialization.
 */
async function loadPlayableLesson(lessonId: string) {
  const access = await getLessonContentAccess(lessonId);

  if (access.status !== "allowed") {
    return access;
  }

  const [lesson, session] = await Promise.all([getLesson(lessonId), getSession()]);

  if (!lesson) {
    return { status: "unavailable" as const };
  }

  if (lesson.generationStatus !== "completed") {
    return {
      generationTarget: await getNotGeneratedLessonTarget(lesson),
      lesson,
      status: "notGenerated" as const,
    };
  }

  const reviewData =
    lesson.kind === "review"
      ? await getReviewLessonData({
          chapterId: lesson.chapterId,
          position: lesson.position,
          userId: session?.user.id ?? null,
        })
      : null;

  if (reviewData && reviewData.steps.length === 0) {
    return {
      generationLessonId: reviewData.generationLessonId,
      lesson,
      status: "reviewEmpty" as const,
    };
  }

  const steps = reviewData?.steps ?? lesson.steps;
  const resources = await getPlayableLessonResources(steps);

  return { lesson, resources, status: "playable" as const, steps };
}

/**
 * Composes the playable lesson inside the complete private lesson-content
 * boundary so this internal helper does not create a redundant cache scope.
 */
async function getPlayableLesson(lessonId: string) {
  if (!isUuid(lessonId)) {
    return { status: "unavailable" as const };
  }

  const [result, session] = await Promise.all([loadPlayableLesson(lessonId), getSession()]);

  cacheTag(getLessonCacheTag(lessonId));

  if (result.status !== "unavailable" && result.status !== "subscriptionRequired") {
    cacheTag(getChapterLessonsCacheTag(result.lesson.chapterId));
  }

  if (session) {
    cacheTag(getUserProgressCacheTag(session.user.id));
  }

  return result;
}

/**
 * Serializes the lesson inside the complete private lesson-content boundary so
 * randomized data remains scoped to the same browser cache entry.
 */
async function preparePlayerLesson(input: PreparePlayerLessonInput) {
  return preparePlayerLessonData(input);
}

/**
 * Returns the complete route-neutral player payload behind one lesson-content
 * resource. Delivery apps should not repeat resource hydration or player
 * serialization, while non-ready outcomes remain small enough to compose with
 * the separate lesson metadata and curriculum resources.
 */
export async function getLessonContent(lessonId: string) {
  "use cache: private";

  const result = await getPlayableLesson(lessonId);

  if (result.status !== "playable") {
    return result;
  }

  const lesson = await preparePlayerLesson({
    chapterSentences: result.resources.chapterSentences,
    chapterWords: result.resources.chapterWords,
    distractorWords: result.resources.distractorWords,
    lesson: result.lesson,
    sentenceWords: result.resources.sentenceWords,
    steps: result.steps,
  });

  return { lesson, status: "ready" as const };
}
