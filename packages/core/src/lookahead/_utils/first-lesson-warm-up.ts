import "server-only";
import { prisma } from "@zoonk/db";
import { readReadyWarmUpId } from "../../library/warm-ups/claim-warm-up";

/**
 * A learner well into a goal doesn't get its beginner cards again. Finished lesson runs count
 * without their lessons, so one whose lesson was deleted still does.
 */
export async function findFirstLessonWarmUp({
  lessonId,
  userId,
}: {
  lessonId: string;
  userId: string;
}): Promise<string | null> {
  const [goal] = await prisma.$queryRaw<{ warmUpId: string }[]>`
    SELECT g.warm_up_id AS "warmUpId"
    FROM goals g
    WHERE g.user_id = ${userId}::uuid
      AND g.status <> 'archived'
      AND g.warm_up_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM plan_items item JOIN plans plan ON plan.id = item.plan_id
        WHERE plan.goal_id = g.id AND item.lesson_id = ${lessonId}::uuid
      )
      AND NOT EXISTS (
        SELECT 1 FROM learning_events run
        WHERE run.user_id = g.user_id
          AND run.kind IN ('lesson', 'review')
          AND run.lesson_kind = 'library'
          AND run.ended_at IS NOT NULL
          AND (
            run.goal_id = g.id
            OR EXISTS (
              SELECT 1 FROM plan_items item JOIN plans plan ON plan.id = item.plan_id
              WHERE plan.goal_id = g.id
                AND item.lesson_id = (run.content_ids->>'lessonId')::uuid
            )
          )
      )
    LIMIT 1`;

  return readReadyWarmUpId(goal?.warmUpId ?? null);
}
