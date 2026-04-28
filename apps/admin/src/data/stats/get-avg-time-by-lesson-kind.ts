import "server-only";
import { prisma } from "@zoonk/db";
import { cache } from "react";

export const getAvgTimeByLessonKind = cache(async (start: Date, end: Date) => {
  const results = await prisma.$queryRaw<
    { kind: string; avg_duration: number; completed: bigint; started: bigint }[]
  >`
    SELECT
      l.kind,
      AVG(lp.duration_seconds) as avg_duration,
      COUNT(*) FILTER (WHERE lp.completed_at IS NOT NULL) as completed,
      COUNT(*) as started
    FROM lesson_progress lp
    JOIN lessons l ON l.id = lp.lesson_id
    WHERE lp.started_at >= ${start} AND lp.started_at <= ${end}
    GROUP BY l.kind
    ORDER BY avg_duration DESC
  `;

  return results.map((row) => ({
    avgDuration: Math.round(row.avg_duration),
    completionCount: Number(row.completed),
    completionRate:
      Number(row.started) === 0 ? 0 : (Number(row.completed) / Number(row.started)) * 100,
    kind: row.kind,
    startedCount: Number(row.started),
  }));
});
