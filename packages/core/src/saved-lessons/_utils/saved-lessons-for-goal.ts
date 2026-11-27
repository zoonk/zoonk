import { type Sql, sql } from "@zoonk/db";

export function savedLessonsForGoal({ goalId, userId }: { goalId: Sql; userId: Sql }): Sql {
  return sql`
    SELECT saved.id, saved.lesson_id, saved.title, saved.created_at
    FROM saved_lessons saved
    WHERE saved.user_id = ${userId}
      AND (
        saved.goal_id = ${goalId}
        OR EXISTS (
          SELECT 1 FROM plan_items item JOIN plans plan ON plan.id = item.plan_id
          WHERE plan.goal_id = ${goalId} AND item.lesson_id = saved.lesson_id
        )
      )`;
}
