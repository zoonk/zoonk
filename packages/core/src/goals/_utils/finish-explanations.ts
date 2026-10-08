import "server-only";
import { prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getGoalsCacheTag, getLearningProfileCacheTag } from "../../cache/tags";
import { moveActiveGoalAway } from "./goal-status";

/**
 * A quick explanation is one answer, with no plan to follow: once the learner finishes its lesson,
 * it's done. It leaves the goal switcher (the apps find it again from search) and the tabs move to
 * a goal with a plan. Only the learner's own explanations finish: another learner who asked the
 * same question shares the lesson but still has theirs to read.
 *
 * Internal: the lesson player's completion derives `userId` from the session first.
 */
export async function finishExplanations({
  lessonId,
  userId,
}: {
  lessonId: string;
  userId: string;
}): Promise<void> {
  const finished = await prisma.goal.updateManyAndReturn({
    data: { status: "completed" },
    select: { id: true },
    where: { kind: "explain", plan: { items: { some: { lessonId } } }, status: "active", userId },
  });

  if (finished.length === 0) {
    return;
  }

  await Promise.all(
    finished.map((goal) => moveActiveGoalAway({ goalId: goal.id, status: "completed", userId })),
  );

  revalidateCacheTags([getGoalsCacheTag(userId), getLearningProfileCacheTag(userId)]);
}
