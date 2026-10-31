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

/** Keeps a primary course the goal already has, unless `replace` asks for this one instead. */
export async function setGoalPrimaryCourse({
  courseId,
  goalId,
  replace = false,
}: {
  courseId: string;
  goalId: string;
  replace?: boolean;
}): Promise<void> {
  const goal = await prisma.goal.findUnique({ select: { userId: true }, where: { id: goalId } });

  if (!goal) {
    return;
  }

  const marker = { goalIds: [goalId], planInputs: true, userId: goal.userId };

  const count = await writeLearnerChange(marker, async (tx) => {
    const updated = await tx.goal.updateMany({
      data: { primaryCourseId: courseId },
      where: {
        OR: replace
          ? [{ primaryCourseId: null }, { primaryCourseId: { not: courseId } }]
          : [{ primaryCourseId: null }],
        id: goalId,
      },
    });

    return updated.count > 0 ? updated.count : unchanged(0);
  });

  if (count > 0) {
    revalidateCacheTags([getGoalsCacheTag(goal.userId)]);
  }
}
