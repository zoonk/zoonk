import "server-only";
import { prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getGoalsCacheTag, getLearningProfileCacheTag } from "../../cache/tags";
import { markLearnerChanged } from "../../learner/_utils/mark-learner-changed";
import { moveActiveGoalAway } from "./goal-status";

/** No active explanation means the early marker must roll back with the no-op. */
class ExplanationsUnchangedError extends Error {
  override name = "ExplanationsUnchangedError";
}

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
  try {
    await prisma.$transaction(async (tx) => {
      await markLearnerChanged(tx, { planInputs: true, userId });

      const finished = await tx.goal.updateManyAndReturn({
        data: { status: "completed" },
        select: { id: true },
        where: {
          kind: "explain",
          plan: { items: { some: { lessonId } } },
          status: "active",
          userId,
        },
      });

      if (finished.length === 0) {
        throw new ExplanationsUnchangedError();
      }

      await Promise.all(
        finished.map((goal) =>
          moveActiveGoalAway({ goalId: goal.id, status: "completed", tx, userId }),
        ),
      );
    });
  } catch (error) {
    if (error instanceof ExplanationsUnchangedError) {
      return;
    }

    throw error;
  }

  revalidateCacheTags([getGoalsCacheTag(userId), getLearningProfileCacheTag(userId)]);
}
