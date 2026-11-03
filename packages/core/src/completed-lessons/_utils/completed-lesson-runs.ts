import { type Sql, sql } from "@zoonk/db";

/**
 * A goal's finished Library lesson runs, one row each, with the lesson they finished. A run counts
 * when its lesson is in the goal's plan, since finishing a lesson checks it off in every plan, or
 * when it was recorded under the goal. Capsule reviews name a lesson but aren't runs of it.
 */
export function completedLessonRuns({ goalId, userId }: { goalId: Sql; userId: Sql }): Sql {
  return sql`
    SELECT run.ended_at, run.local_date, lesson.id AS lesson_id, lesson.title,
      lesson.home_chapter_id
    FROM learning_events run
    JOIN library_lessons lesson ON lesson.id = (run.content_ids->>'lessonId')::uuid
    WHERE run.user_id = ${userId}
      AND run.kind IN ('lesson', 'review')
      AND run.lesson_kind = 'library'
      AND run.ended_at IS NOT NULL
      AND (
        run.goal_id = ${goalId}
        OR EXISTS (
          SELECT 1 FROM plan_items item JOIN plans plan ON plan.id = item.plan_id
          WHERE plan.goal_id = ${goalId} AND item.lesson_id = lesson.id
        )
      )`;
}
