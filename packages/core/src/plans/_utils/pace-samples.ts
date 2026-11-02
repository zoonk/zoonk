import "server-only";
import { prisma } from "@zoonk/db";
import { lessonPacesSql } from "@zoonk/db/anonymous-records";
import { addDays } from "../planner/plan-calendar";
import { type PaceSample } from "../planner/plan-pace";

const RECENT_DAYS = 30;
export const PACE_LESSON_LIMIT = 500;
const SAMPLE_LIMIT = 5000;
const OWN_LIMIT = 200;

/**
 * Seconds per estimated minute: outside a fifth to four times the estimate is a tab left open or a
 * skipped lesson.
 */
const MIN_SECONDS_PER_MINUTE = 12;
const MAX_SECONDS_PER_MINUTE = 240;

type SampleRow = { count: number; ratio: number | null };

function toSample(row: SampleRow | undefined): PaceSample | null {
  return row && row.ratio !== null ? { count: row.count, ratio: row.ratio } : null;
}

async function loadOwnSample(userId: string): Promise<PaceSample | null> {
  const rows = await prisma.$queryRaw<SampleRow[]>`
    SELECT count(*)::int AS count, sum(e.seconds)::float / nullif(sum(l.estimated_minutes * 60), 0) AS ratio
    FROM (
      SELECT seconds, content_ids->>'lessonId' AS lesson_id
      FROM learning_events
      WHERE user_id = ${userId}::uuid AND kind = 'lesson' AND ended_at IS NOT NULL
        AND content_ids->>'lessonId' ~* '^[0-9a-f-]{36}$'
      ORDER BY ended_at DESC
      LIMIT ${OWN_LIMIT}
    ) e
    JOIN library_lessons l ON l.id = e.lesson_id::uuid
    WHERE e.seconds BETWEEN l.estimated_minutes * ${MIN_SECONDS_PER_MINUTE}
      AND l.estimated_minutes * ${MAX_SECONDS_PER_MINUTE}`;

  return toSample(rows[0]);
}

async function loadSharedSamples({
  lessonIds,
  now,
  userId,
}: {
  lessonIds: readonly string[];
  now: Date;
  userId: string | null;
}): Promise<{ course: PaceSample | null; typical: PaceSample | null }> {
  const since = addDays(now, -RECENT_DAYS);

  const rows = await prisma.$queryRaw<
    {
      courseCount: number;
      courseRatio: number | null;
      typicalCount: number;
      typicalRatio: number | null;
    }[]
  >`
    SELECT
      (count(*) FILTER (WHERE s.in_plan))::int AS "courseCount",
      (sum(s.seconds) FILTER (WHERE s.in_plan))::float
        / nullif(sum(s.expected) FILTER (WHERE s.in_plan), 0) AS "courseRatio",
      count(*)::int AS "typicalCount",
      sum(s.seconds)::float / nullif(sum(s.expected), 0) AS "typicalRatio"
    FROM (
      SELECT
        e.seconds,
        l.estimated_minutes * 60 AS expected,
        (e.user_id IS DISTINCT FROM ${userId}::uuid
          AND l.id::text = ANY(${[...lessonIds]}::text[])) AS in_plan
      FROM ${lessonPacesSql({ since, until: now })} e
      JOIN library_lessons l ON l.id = e.lesson_id
      WHERE e.seconds BETWEEN l.estimated_minutes * ${MIN_SECONDS_PER_MINUTE}
        AND l.estimated_minutes * ${MAX_SECONDS_PER_MINUTE}
      LIMIT ${SAMPLE_LIMIT}
    ) s`;

  const row = rows[0];

  return {
    course: toSample(row ? { count: row.courseCount, ratio: row.courseRatio } : undefined),
    typical: toSample(row ? { count: row.typicalCount, ratio: row.typicalRatio } : undefined),
  };
}

export async function loadPaceSamples({
  lessonIds,
  now,
  userId,
}: {
  lessonIds: readonly string[];
  now: Date;
  userId: string | null;
}) {
  const [own, shared] = await Promise.all([
    userId ? loadOwnSample(userId) : null,
    loadSharedSamples({ lessonIds, now, userId }),
  ]);

  return { own, ...shared };
}
