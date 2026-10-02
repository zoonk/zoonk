import "server-only";
import { type CourseFormat, type GoalKind, prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getGoalsCacheTag } from "../../cache/tags";

/** Language courses teach a language pair; private courses are one learner's; everything else is core. */
export function getGoalCourseFormat({
  kind,
  ownerId,
}: {
  kind: GoalKind;
  ownerId: string | null;
}): CourseFormat {
  if (ownerId) {
    return "personalized";
  }

  return kind === "language" ? "language" : "core";
}

/**
 * Points a goal at the course its first phase is taught in, unless the learner or onboarding
 * already chose one. Screens link to it as the goal's main course.
 */
export async function setGoalPrimaryCourse({
  courseId,
  goalId,
}: {
  courseId: string;
  goalId: string;
}): Promise<void> {
  const goal = await prisma.goal.findUnique({ select: { userId: true }, where: { id: goalId } });

  if (!goal) {
    return;
  }

  const { count } = await prisma.goal.updateMany({
    data: { primaryCourseId: courseId },
    where: { id: goalId, primaryCourseId: null },
  });

  if (count > 0) {
    revalidateCacheTags([getGoalsCacheTag(goal.userId)]);
  }
}
