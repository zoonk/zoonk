import { hasActiveSubscription } from "../auth/subscription";
import { getLessonAccessRequirement } from "../lessons/access";
import { isStandaloneGeneratedLessonKind } from "../lessons/generated-companion-kinds";
import { getLessonForGeneration } from "../lessons/get-lesson-for-generation";

/**
 * Applies AI ownership, standalone-kind, and chapter subscription rules before
 * a delivery app starts lesson generation or preloading.
 */
export async function getLessonGenerationAccess(lessonId: string) {
  const lesson = await getLessonForGeneration(lessonId);

  if (!lesson || !isStandaloneGeneratedLessonKind(lesson.kind)) {
    return { status: "notFound" as const };
  }

  const requirement = getLessonAccessRequirement({ lesson });

  if (requirement === "subscription" && !(await hasActiveSubscription())) {
    return { status: "subscriptionRequired" as const };
  }

  return { lesson, status: "ready" as const };
}
