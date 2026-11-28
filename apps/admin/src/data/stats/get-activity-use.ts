import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma, sql } from "@zoonk/db";

export type ActivityUseRow = {
  activityScreens: number;
  /** Planned activities the lesson's current screens show with the template the plan named. */
  keptActivities: number;
  lessons: number;
  lessonsWithActivity: number;
  plannedActivities: number;
  screens: number;
};

export type ActivityUse = {
  all: ActivityUseRow;
  /** One row per course subject, and a `null` subject for lessons outside any categorized course. */
  subjects: (ActivityUseRow & { subject: string | null })[];
};

type ActivityUseSqlRow = ActivityUseRow & { allSubjects: boolean; subject: string | null };

const EMPTY_ROW: ActivityUseRow = {
  activityScreens: 0,
  keptActivities: 0,
  lessons: 0,
  lessonsWithActivity: 0,
  plannedActivities: 0,
  screens: 0,
};

/**
 * Lessons written from a lesson plan, dated by when their current screens were first written, since
 * that's when the planner's prompt shaped them. Language-course lessons go to a writer that never
 * uses activities, and challenge and explanation lessons have no plan, so they're left out. A lesson
 * counts under each subject of its home course; the all-subjects row counts it once.
 */
export const getActivityUse = cacheAdminData(async (start: Date, end: Date) => {
  const rows = await prisma.$queryRaw<ActivityUseSqlRow[]>(sql`
    WITH dated AS (
      SELECT
        lesson_id,
        COUNT(*)::int AS screens,
        (COUNT(*) FILTER (WHERE kind = 'activity'))::int AS activity_screens
      FROM library_steps
      WHERE retired_at IS NULL AND staged = false
      GROUP BY lesson_id
      HAVING MIN(generated_at) >= ${start} AND MIN(generated_at) <= ${end}
    ),
    written AS (
      SELECT dated.*, chapters.home_course_id AS course_id
      FROM dated
      JOIN library_lessons lessons ON lessons.id = dated.lesson_id
      LEFT JOIN library_chapters chapters ON chapters.id = lessons.home_chapter_id
      WHERE lessons.target_language IS NULL AND jsonb_typeof(lessons.spec->'screens') = 'array'
    ),
    planned AS (
      SELECT written.lesson_id, screen->>'activityTemplate' AS template, COUNT(*)::int AS planned
      FROM written
      JOIN library_lessons lessons ON lessons.id = written.lesson_id
      CROSS JOIN LATERAL jsonb_array_elements(lessons.spec->'screens') AS screen
      WHERE screen->>'kind' = 'activity'
        OR (screen->>'kind' = 'application' AND screen->>'activityTemplate' IS NOT NULL)
      GROUP BY written.lesson_id, screen->>'activityTemplate'
    ),
    published AS (
      SELECT steps.lesson_id, steps.content->>'template' AS template, COUNT(*)::int AS published
      FROM library_steps steps
      JOIN written ON written.lesson_id = steps.lesson_id
      WHERE steps.retired_at IS NULL AND steps.staged = false AND steps.kind = 'activity'
      GROUP BY steps.lesson_id, steps.content->>'template'
    ),
    kept AS (
      SELECT
        planned.lesson_id,
        SUM(planned.planned)::int AS planned,
        SUM(LEAST(planned.planned, COALESCE(published.published, 0)))::int AS kept
      FROM planned
      LEFT JOIN published
        ON published.lesson_id = planned.lesson_id AND published.template = planned.template
      GROUP BY planned.lesson_id
    ),
    lessons AS (
      SELECT
        written.screens,
        written.activity_screens,
        written.course_id,
        COALESCE(kept.planned, 0) AS planned,
        COALESCE(kept.kept, 0) AS kept
      FROM written
      LEFT JOIN kept ON kept.lesson_id = written.lesson_id
    )
    SELECT
      true AS "allSubjects",
      NULL AS subject,
      COUNT(*)::int AS lessons,
      (COUNT(*) FILTER (WHERE activity_screens > 0))::int AS "lessonsWithActivity",
      COALESCE(SUM(screens), 0)::int AS screens,
      COALESCE(SUM(activity_screens), 0)::int AS "activityScreens",
      COALESCE(SUM(planned), 0)::int AS "plannedActivities",
      COALESCE(SUM(kept), 0)::int AS "keptActivities"
    FROM lessons

    UNION ALL

    SELECT
      false AS "allSubjects",
      categories.category AS subject,
      COUNT(*)::int AS lessons,
      (COUNT(*) FILTER (WHERE activity_screens > 0))::int AS "lessonsWithActivity",
      SUM(screens)::int AS screens,
      SUM(activity_screens)::int AS "activityScreens",
      SUM(planned)::int AS "plannedActivities",
      SUM(kept)::int AS "keptActivities"
    FROM lessons
    LEFT JOIN course_categories categories ON categories.course_id = lessons.course_id
    GROUP BY categories.category
  `);

  return {
    all: rows.find((row) => row.allSubjects) ?? EMPTY_ROW,
    subjects: rows.filter((row) => !row.allSubjects),
  } satisfies ActivityUse;
});
