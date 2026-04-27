import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";

/**
 * The continue-learning feed only needs the learner's most recent completion
 * anchor per course. Keeping that SQL in one helper makes the main feed logic
 * about item selection instead of raw historical query details.
 */
export type ContinueLearningRow = {
  activityPosition: number;
  chapterId: string;
  chapterPosition: number;
  courseId: string;
  courseImageUrl: string | null;
  courseSlug: string;
  courseTitle: string;
  lessonId: string;
  lessonPosition: number;
  orgSlug: string | null;
};

/**
 * The feed intentionally over-fetches recent courses because some of them will
 * be filtered out later after durable completion and current curriculum checks.
 */
const SQL_LIMIT = 10;

/**
 * Historical completions should keep a course eligible for continue-learning
 * even after old activity rows are archived. This query therefore anchors on
 * the learner's most recent completion per course, then lets later helpers
 * resolve the actual current destination from the live curriculum.
 */
export async function listRecentContinueLearningRows({
  userId,
}: {
  userId: string;
}): Promise<ContinueLearningRow[]> {
  const { data, error } = await safeAsync(
    () =>
      prisma.$queryRaw<ContinueLearningRow[]>`
        WITH last_per_course AS (
          SELECT DISTINCT ON (ch.course_id)
            ch.course_id,
            ap.completed_at,
            c.slug as course_slug,
            c.title as course_title,
            c.image_url as course_image_url,
            o.slug as org_slug,
            a.position as activity_position,
            a.lesson_id,
            l.position as lesson_position,
            l.chapter_id,
            ch.position as chapter_position
          FROM activity_progress ap
          JOIN activities a ON a.id = ap.activity_id
          JOIN lessons l ON l.id = a.lesson_id
          JOIN chapters ch ON ch.id = l.chapter_id
          JOIN courses c ON c.id = ch.course_id AND c.is_published = true AND c.archived_at IS NULL
          LEFT JOIN organizations o ON o.id = c.organization_id
          WHERE ap.user_id = ${userId} AND ap.completed_at IS NOT NULL AND (o.kind = 'brand' OR o.id IS NULL)
          ORDER BY ch.course_id, ap.completed_at DESC
        )
        SELECT
          lpc.course_id as "courseId",
          lpc.course_slug as "courseSlug",
          lpc.course_title as "courseTitle",
          lpc.course_image_url as "courseImageUrl",
          lpc.org_slug as "orgSlug",
          lpc.activity_position as "activityPosition",
          lpc.lesson_id as "lessonId",
          lpc.lesson_position as "lessonPosition",
          lpc.chapter_id as "chapterId",
          lpc.chapter_position as "chapterPosition"
        FROM last_per_course lpc
        ORDER BY lpc.completed_at DESC
        LIMIT ${SQL_LIMIT}
      `,
  );

  if (error || !data) {
    return [];
  }

  return data;
}
