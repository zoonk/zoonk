import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { ALPHABET_IDENTITY_PREFIX } from "@zoonk/core/library/language/alphabet-identity";
import { prisma, sql } from "@zoonk/db";
import { type CourseCategory } from "@zoonk/utils/categories";

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
  /**
   * One row per course subject, and a `null` subject for lessons outside any categorized course.
   * Language lessons make the `languages` row, whatever their course.
   */
  subjects: (ActivityUseRow & { subject: string | null })[];
};

const LANGUAGE_SUBJECT: CourseCategory = "languages";

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
 * Lessons dated by when their current screens were first written, since that's when their activities
 * were chosen. Only lessons written from a plan count toward planned and kept: a language lesson's
 * writer picks its own activities and ignores any old plan. Challenge and explanation lessons have no
 * plan, and alphabet lessons' writer never uses activities, so they're left out. A planned lesson
 * counts under each subject of its home course and a language lesson under languages; the
 * all-subjects row counts each lesson once.
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
      SELECT
        dated.*,
        chapters.home_course_id AS course_id,
        lessons.target_language IS NOT NULL AS language,
        CASE WHEN lessons.target_language IS NULL THEN lessons.spec->'screens' END AS plan
      FROM dated
      JOIN library_lessons lessons ON lessons.id = dated.lesson_id
      LEFT JOIN library_chapters chapters ON chapters.id = lessons.home_chapter_id
      WHERE CASE
        WHEN lessons.target_language IS NULL THEN jsonb_typeof(lessons.spec->'screens') = 'array'
        ELSE NOT starts_with(lessons.identity_key, ${ALPHABET_IDENTITY_PREFIX})
      END
    ),
    planned AS (
      SELECT written.lesson_id, screen->>'activityTemplate' AS template, COUNT(*)::int AS planned
      FROM written
      CROSS JOIN LATERAL jsonb_array_elements(written.plan) AS screen
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
        written.language,
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
      CASE WHEN lessons.language THEN ${LANGUAGE_SUBJECT} ELSE categories.category END AS subject,
      COUNT(*)::int AS lessons,
      (COUNT(*) FILTER (WHERE activity_screens > 0))::int AS "lessonsWithActivity",
      SUM(screens)::int AS screens,
      SUM(activity_screens)::int AS "activityScreens",
      SUM(planned)::int AS "plannedActivities",
      SUM(kept)::int AS "keptActivities"
    FROM lessons
    LEFT JOIN course_categories categories
      ON categories.course_id = lessons.course_id AND NOT lessons.language
    GROUP BY subject
  `);

  return {
    all: rows.find((row) => row.allSubjects) ?? EMPTY_ROW,
    subjects: rows.filter((row) => !row.allSubjects),
  } satisfies ActivityUse;
});
