import "server-only";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getGoalsCacheTag, getLearningProfileCacheTag } from "../../cache/tags";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { moveActiveGoalAway } from "./goal-status";

export async function finishExplanations({
  lessonId,
  userId,
}: {
  lessonId: string;
  userId: string;
}): Promise<void> {
  const changed = await writeLearnerChange({ planInputs: true, userId }, async (tx) => {
    const finished = await tx.goal.updateManyAndReturn({
      data: { status: "completed" },
      select: { id: true },
      where: { kind: "explain", plan: { items: { some: { lessonId } } }, status: "active", userId },
    });

    if (finished.length === 0) {
      return unchanged(false);
    }

    await Promise.all(
      finished.map((goal) =>
        moveActiveGoalAway({ goalId: goal.id, status: "completed", tx, userId }),
      ),
    );

    return true;
  });

  if (changed) {
    revalidateCacheTags([getGoalsCacheTag(userId), getLearningProfileCacheTag(userId)]);
  }
}
