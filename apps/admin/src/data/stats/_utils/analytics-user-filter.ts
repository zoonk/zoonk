import { sql } from "@zoonk/db";

export const trackedAnalyticsUserWhere = { analyticsDisabled: false } as const;
export const trackedAnalyticsUserRelationWhere = { user: trackedAnalyticsUserWhere } as const;
export const trackedAnalyticsUserSql = sql`users.analytics_disabled = FALSE`;

/**
 * A day with at least one finished lesson. `lessons_completed` also covers days the learner-stats
 * backfill recovered from legacy lessons, which have no completion counters.
 */
export const completedLessonActivitySql = sql`(
  daily_progress.interactive_completed > 0
  OR daily_progress.static_completed > 0
  OR daily_progress.lessons_completed > 0
)`;
