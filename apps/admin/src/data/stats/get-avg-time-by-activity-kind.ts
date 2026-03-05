import "server-only";
import { prisma } from "@zoonk/db";
import { cache } from "react";

export const getAvgTimeByActivityKind = cache(async (start: Date, end: Date) => {
  const results = await prisma.$queryRaw<
    { kind: string; avg_duration: number; completed: bigint; started: bigint }[]
  >`
    SELECT
      a.kind,
      AVG(ap.duration_seconds) as avg_duration,
      COUNT(*) FILTER (WHERE ap.completed_at IS NOT NULL) as completed,
      COUNT(*) as started
    FROM activity_progress ap
    JOIN activities a ON a.id = ap.activity_id
    WHERE ap.started_at >= ${start} AND ap.started_at <= ${end}
    GROUP BY a.kind
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
