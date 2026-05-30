import { auth } from "@zoonk/core/auth";
import { hasActiveSubscription } from "@zoonk/core/auth/subscription";
import { getLessonAccessRequirement } from "@zoonk/core/lessons/access";
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
 * Lesson generation and preload share one free-tier rule. Loading the chapter
 * with the lesson keeps that rule tied to trusted database positions instead
 * of accepting client-provided course or chapter order.
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
 * Position 0 is the product's first-chapter marker. Only that chapter can be
 * generated before the learner has an active subscription.
 */
export function requiresSubscriptionForChapterGeneration(chapter: Pick<Chapter, "position">) {
  return chapter.position !== 0;
}

/**
 * Paid-plan checks depend on the trusted chapter or lesson row because first
 * chapter generation has a free exception. Run this only after the route has
 * loaded the AI-owned entity and knows whether the subscription rule applies.
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

/**
 * Lesson workflows have three access states: public preview, login-expanded
 * preview, and paid access. Keeping that decision here lets generation and
 * preload return the same 401-or-402 contract for the same lesson position.
 */
export async function getWorkflowLessonAccessError(params: {
  headers: Headers;
  lesson: LessonWithChapter;
}) {
  const session = await auth.api.getSession({ headers: params.headers });

  const requirement = getLessonAccessRequirement({
    isAuthenticated: Boolean(session),
    lesson: params.lesson,
  });

  if (requirement === "authentication") {
    return errors.unauthorized();
  }

  return getWorkflowSubscriptionAccessError({
    headers: params.headers,
    requiresSubscription: requirement === "subscription",
  });
}
