import "server-only";
import { type TransactionClient } from "@zoonk/db";
import { moveActiveGoalAway } from "./goal-status";

/** Call in the lesson completion's transaction, after its learner mark; on true the caller expires the goal and learning profile tags. */
export async function finishExplanations(
  tx: TransactionClient,
  { lessonId, userId }: { lessonId: string; userId: string },
): Promise<boolean> {
  const finished = await tx.goal.updateManyAndReturn({
    data: { status: "completed" },
    select: { id: true },
    where: { kind: "explain", plan: { items: { some: { lessonId } } }, status: "active", userId },
  });

  await Promise.all(
    finished.map((goal) =>
      moveActiveGoalAway({ goalId: goal.id, status: "completed", tx, userId }),
    ),
  );

  return finished.length > 0;
}
