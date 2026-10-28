import "server-only";
import { type CourseFormat, type GoalKind, prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getGoalsCacheTag } from "../../cache/tags";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";

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

  const marker = { planInputs: true, userId: goal.userId };

  const count = await writeLearnerChange(marker, async (tx) => {
    const updated = await tx.goal.updateMany({
      data: { primaryCourseId: courseId },
      where: { id: goalId, primaryCourseId: null },
    });

    return updated.count > 0 ? updated.count : unchanged(0);
  });

  if (count > 0) {
    revalidateCacheTags([getGoalsCacheTag(goal.userId)]);
  }
}
