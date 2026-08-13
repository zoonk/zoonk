import "server-only";
import { hasActiveSubscription } from "../auth/subscription";
import { getLessonAccessRequirement } from "../lessons/access";
import {
  isGeneratedCompanionLessonKind,
  isGeneratedLessonKind,
} from "../lessons/generated-companion-kinds";
import {
  getGeneratedCompanionForSourceLesson,
  getSourceLessonForGeneratedCompanion,
} from "../lessons/generated-companions";
import { getLessonForGeneration } from "../lessons/get-lesson-for-generation";

/**
 * Resolves the route-neutral state needed to render a lesson generation page.
 * Delivery apps only translate the result into navigation and presentation;
 * subscription rules, companion ownership, and readiness remain consistent
 * across web, API, and future native clients. The read remains uncached because
 * generation pages disable prefetching and API handlers call it only once.
 */
export async function getLessonGenerationView(lessonId: string) {
  const lesson = await getLessonForGeneration(lessonId);

  if (!lesson || !isGeneratedLessonKind(lesson.kind)) {
    return { status: "notFound" as const };
  }

  const requiresSubscription = getLessonAccessRequirement({ lesson }) === "subscription";

  if (requiresSubscription && !(await hasActiveSubscription())) {
    return { lesson, lessonKind: lesson.kind, status: "subscriptionRequired" as const };
  }

  if (lesson.generationStatus !== "completed" && isGeneratedCompanionLessonKind(lesson.kind)) {
    const sourceLesson = await getSourceLessonForGeneratedCompanion({
      chapterId: lesson.chapterId,
      lessonId: lesson.id,
    });

    if (!sourceLesson) {
      return { status: "notFound" as const };
    }

    return {
      lesson,
      lessonKind: lesson.kind,
      sourceLessonId: sourceLesson.id,
      status: "redirectToSource" as const,
    };
  }

  const companionLesson = await getGeneratedCompanionForSourceLesson({
    chapterId: lesson.chapterId,
    lessonId: lesson.id,
  });

  const companionNeedsRepair =
    companionLesson?.generationStatus === "pending" ||
    companionLesson?.generationStatus === "failed";

  return {
    isReadyForRedirect:
      (lesson.generationStatus === "completed" || lesson._count.steps > 0) && !companionNeedsRepair,
    lesson,
    lessonKind: lesson.kind,
    status: "ready" as const,
  };
}
