import { hasActiveSubscription } from "../auth/subscription";
import { getLessonAccessRequirement } from "../lessons/access";
import { isStandaloneGeneratedLessonKind } from "../lessons/generated-companion-kinds";
import { getLessonForGeneration } from "../lessons/get-lesson-for-generation";
import { getSession } from "../users/get-session";

/** A pending row with saved steps is repaired without AI work; failed rows regenerate their partial content. */
function shouldClaimLessonGenerationQuota(
  lesson: NonNullable<Awaited<ReturnType<typeof getLessonForGeneration>>>,
): boolean {
  if (lesson.generationStatus === "failed") {
    return true;
  }

  return lesson.generationStatus === "pending" && lesson._count.steps === 0;
}

/**
 * Applies AI ownership, standalone-kind, and chapter subscription rules before
 * a delivery app starts lesson generation or preloading.
 */
export async function getLessonGenerationAccess(lessonId: string) {
  const [lesson, session] = await Promise.all([getLessonForGeneration(lessonId), getSession()]);

  if (!lesson || !isStandaloneGeneratedLessonKind(lesson.kind)) {
    return { status: "notFound" as const };
  }

  const requirement = getLessonAccessRequirement({ lesson });
  const isAdmin = session?.user.role === "admin";

  if (requirement === "subscription" && !isAdmin && !(await hasActiveSubscription())) {
    return { status: "subscriptionRequired" as const };
  }

  return {
    lesson,
    shouldClaimQuota: isAdmin ? false : shouldClaimLessonGenerationQuota(lesson),
    status: "ready" as const,
  };
}
