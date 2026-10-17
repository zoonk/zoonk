import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { trackedAnalyticsUserSql } from "@/data/stats/_utils/analytics-user-filter";
import { timedLessonSql } from "@/data/stats/_utils/timed-lesson";
import { prisma } from "@zoonk/db";

/**
 * Lesson kinds come from the ledger's text snapshot, so legacy and new kinds stay readable after
 * their lessons are deleted.
 */
export const getAvgTimeByLessonKind = cacheAdminData(async (start: Date, end: Date) => {
  const results = await prisma.$queryRaw<
    { kind: string; avg_duration: number | null; completed: bigint; started: bigint }[]
  >`
    SELECT
      COALESCE(learning_events.lesson_kind, 'unknown') AS kind,
      AVG(learning_events.seconds) FILTER (WHERE ${timedLessonSql}) AS avg_duration,
      COUNT(*) FILTER (WHERE learning_events.ended_at IS NOT NULL) AS completed,
      COUNT(*) AS started
    FROM learning_events
    JOIN users ON users.id = learning_events.user_id
    WHERE
      ${trackedAnalyticsUserSql}
      AND learning_events.kind = 'lesson'
      AND learning_events.started_at >= ${start}
      AND learning_events.started_at <= ${end}
    GROUP BY 1
    ORDER BY avg_duration DESC NULLS LAST
  `;

  return results.map((row) => ({
    avgDuration: Math.round(row.avg_duration ?? 0),
    completionCount: Number(row.completed),
    completionRate:
      Number(row.started) === 0 ? 0 : (Number(row.completed) / Number(row.started)) * 100,
    kind: row.kind,
    startedCount: Number(row.started),
  }));
});
