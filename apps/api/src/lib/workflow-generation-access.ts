import { auth } from "@zoonk/core/auth";
import { hasActiveSubscription } from "@zoonk/core/auth/subscription";
import {
  type Chapter,
  type Lesson,
  getAiGenerationChapterWhere,
  getAiGenerationLessonWhere,
  prisma,
} from "@zoonk/db";
import { errors } from "./api-errors";

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
 * Workflow generation is account-bound before route-specific ids are parsed or
 * looked up. That keeps anonymous callers from probing workflow trigger inputs
 * and prevents client-only page gates from protecting expensive starts.
 */
export async function getWorkflowAuthenticationError(params: { headers: Headers }) {
  const session = await auth.api.getSession({ headers: params.headers });

  if (!session) {
    return errors.unauthorized();
  }

  return null;
}

/**
 * Paid-plan checks still depend on the trusted chapter or lesson row because
 * first-chapter content is free for signed-in learners. Run this only after the
 * route has loaded the AI-owned entity and knows whether the subscription rule
 * applies.
 */
export async function getWorkflowSubscriptionAccessError(params: {
  headers: Headers;
  requiresSubscription: boolean;
}) {
  if (!params.requiresSubscription) {
    return null;
  }

  const hasSubscription = await hasActiveSubscription(params.headers);

  if (!hasSubscription) {
    return errors.paymentRequired();
  }

  return null;
}
