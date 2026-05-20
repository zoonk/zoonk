import { hasActiveSubscription } from "@zoonk/core/auth/subscription";
import {
  type Chapter,
  type Lesson,
  getAiGenerationChapterWhere,
  getAiGenerationLessonWhere,
  prisma,
} from "@zoonk/db";

type LessonWithChapter = Lesson & { chapter: Chapter };

/**
 * Workflow trigger routes receive raw ids from the client, so they need one
 * shared lookup that proves the chapter belongs to the AI curriculum before any
 * subscription exception can apply.
 */
export async function getAiGenerationChapterForWorkflow(params: { chapterId: string }) {
  return prisma.chapter.findFirst({
    where: getAiGenerationChapterWhere({ chapterWhere: { id: params.chapterId } }),
  });
}

/**
 * Lesson generation and preload share the same subscription exception: lessons
 * in the first course chapter are free, later chapters require a subscription.
 * Loading the chapter with the lesson keeps that rule tied to the trusted row
 * instead of accepting a client-provided course or chapter position.
 */
export async function getAiGenerationLessonForWorkflow(params: {
  lessonId: string;
}): Promise<LessonWithChapter | null> {
  return prisma.lesson.findFirst({
    include: { chapter: true },
    where: getAiGenerationLessonWhere({ lessonWhere: { id: params.lessonId } }),
  });
}

/**
 * Position 0 is the product's first-chapter marker. That chapter is the free
 * starter experience; any later chapter stays behind the subscription gate.
 */
export function requiresSubscriptionForChapterGeneration(chapter: Pick<Chapter, "position">) {
  return chapter.position !== 0;
}

/**
 * Lesson access follows the parent chapter, not the lesson position. This lets
 * every lesson in the first chapter be generated or preloaded before purchase.
 */
export function requiresSubscriptionForLessonGeneration(lesson: {
  chapter: Pick<Chapter, "position">;
}) {
  return requiresSubscriptionForChapterGeneration(lesson.chapter);
}

/**
 * First-chapter workflow triggers should not even touch auth, while later
 * chapters must keep using the normal active-subscription check.
 */
export async function hasWorkflowSubscriptionAccess(params: {
  headers: Headers;
  requiresSubscription: boolean;
}) {
  if (!params.requiresSubscription) {
    return true;
  }

  return hasActiveSubscription(params.headers);
}
