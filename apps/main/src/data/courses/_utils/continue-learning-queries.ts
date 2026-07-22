import "server-only";
import { COURSE_LIST_CACHE_TAG, getUserProgressCacheTag } from "@/data/cache-tags";
import { getSession } from "@/data/users/get-session";
import { getLessonKindExclusionSql } from "@zoonk/core/lessons/kind-exclusions";
import { type LessonKind, prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";

/**
 * The continue-learning feed only needs the learner's most recent completion
 * anchor per course. Keeping that SQL in one helper makes the main feed logic
 * about item selection instead of raw historical query details.
 */
export type ContinueLearningRow = {
  chapterId: string;
  chapterPosition: number;
  chapterTitle: string;
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

async function findRecentContinueLearningRows({
  excludedLessonKinds,
  userId,
}: {
  excludedLessonKinds?: LessonKind[];
  userId: string;
}): Promise<ContinueLearningRow[]> {
  "use cache";

  cacheTag(COURSE_LIST_CACHE_TAG, getUserProgressCacheTag(userId));

  const lessonKindFilter = getLessonKindExclusionSql({ excludedLessonKinds });

  return prisma.$queryRaw<ContinueLearningRow[]>`
        WITH last_per_course AS (
          SELECT DISTINCT ON (ch.course_id)
            ch.course_id,
            ap.completed_at,
            c.slug as course_slug,
            c.title as course_title,
            c.image_url as course_image_url,
            o.slug as org_slug,
            l.position as lesson_position,
            l.id as lesson_id,
            l.chapter_id,
            ch.position as chapter_position,
            ch.title as chapter_title
          FROM lesson_progress ap
          JOIN lessons l ON l.id = ap.lesson_id
          JOIN chapters ch ON ch.id = l.chapter_id
          JOIN courses c ON c.id = ch.course_id AND c.is_published = true
          LEFT JOIN organizations o ON o.id = c.organization_id
          WHERE ap.user_id = ${userId}
            AND ap.completed_at IS NOT NULL
            AND ${lessonKindFilter}
            AND (o.kind = 'brand' OR o.id IS NULL)
          ORDER BY ch.course_id, ap.completed_at DESC
        )
        SELECT
          lpc.course_id as "courseId",
          lpc.course_slug as "courseSlug",
          lpc.course_title as "courseTitle",
          lpc.course_image_url as "courseImageUrl",
          lpc.org_slug as "orgSlug",
          lpc.lesson_id as "lessonId",
          lpc.lesson_position as "lessonPosition",
          lpc.chapter_id as "chapterId",
          lpc.chapter_position as "chapterPosition",
          lpc.chapter_title as "chapterTitle"
        FROM last_per_course lpc
        ORDER BY lpc.completed_at DESC
        LIMIT ${SQL_LIMIT}
      `;
}

/**
 * Historical completions keep a course eligible for continue-learning while
 * the current session remains the only source of learner identity.
 */
export async function listRecentContinueLearningRows({
  excludedLessonKinds,
}: {
  excludedLessonKinds?: LessonKind[];
}): Promise<ContinueLearningRow[]> {
  const session = await getSession();

  return session
    ? findRecentContinueLearningRows({ excludedLessonKinds, userId: session.user.id })
    : [];
}
