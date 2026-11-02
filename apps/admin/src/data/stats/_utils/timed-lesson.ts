import { sql } from "@zoonk/db";

/** Finished lessons with recorded time; zero-second sittings don't contribute to averages. */
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
