import { sql } from "@zoonk/db";

/**
 * Finished lessons with recorded time. Backfilled legacy completions that never recorded a duration
 * store zero seconds, which would pull lesson-time averages down.
 */
export const timedLessonWhere = {
  endedAt: { not: null },
  kind: "lesson",
  seconds: { gt: 0 },
} as const;

export const timedLessonSql = sql`(
  learning_events.kind = 'lesson'
  AND learning_events.ended_at IS NOT NULL
  AND learning_events.seconds > 0
)`;
