import "server-only";
import { hasActiveSubscription } from "../auth/subscription";
import { getLessonAccessRequirement } from "../lessons/access";
import {
  type GeneratedLessonKind,
  isGeneratedCompanionLessonKind,
  isGeneratedLessonKind,
} from "../lessons/generated-companion-kinds";
import {
  getGeneratedCompanionForSourceLesson,
  getSourceLessonForGeneratedCompanion,
} from "../lessons/generated-companions";
import { getLessonForGeneration } from "../lessons/get-lesson-for-generation";
import { getSession } from "../users/get-session";

/** Resolves whether persisted lesson content can safely redirect without starting AI work. */
async function getReadyLessonGenerationView({
  lesson,
  lessonKind,
}: {
  lesson: NonNullable<Awaited<ReturnType<typeof getLessonForGeneration>>>;
  lessonKind: GeneratedLessonKind;
}) {
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
    lessonKind,
    status: "ready" as const,
  };
}

/**
 * Resolves the route-neutral state needed to render a lesson generation page.
 * Delivery apps only translate the result into navigation and presentation;
 * authentication, subscription rules, companion ownership, and readiness
 * remain consistent across web, API, and future native clients. The read
 * remains uncached because generation pages disable prefetching and API
 * handlers call it only once.
 */
export async function getLessonGenerationView(lessonId: string) {
  const [lesson, session] = await Promise.all([getLessonForGeneration(lessonId), getSession()]);

  if (!lesson || !isGeneratedLessonKind(lesson.kind)) {
    return { status: "notFound" as const };
  }

  const requiresSubscription = getLessonAccessRequirement({ lesson }) === "subscription";

  if (!session) {
    if (requiresSubscription || lesson.generationStatus !== "completed") {
      return { status: "unauthorized" as const };
    }

    const readyView = await getReadyLessonGenerationView({ lesson, lessonKind: lesson.kind });

    return readyView.isReadyForRedirect ? readyView : { status: "unauthorized" as const };
  }

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

  return getReadyLessonGenerationView({ lesson, lessonKind: lesson.kind });
}
