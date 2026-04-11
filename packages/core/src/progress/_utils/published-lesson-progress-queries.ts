import "server-only";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import {
  type PublishedLessonProgressRow,
  type PublishedLessonProgressScope,
} from "./published-lesson-progress";

/**
 * Progress reads need one shared published lesson snapshot so lesson lists,
 * chapter lists, and navigation all evaluate the same live curriculum tree.
 * This helper dispatches to the narrowest query for the requested scope.
 */
export async function listPublishedLessonProgressRows({
  scope,
  userId,
}: {
  scope: PublishedLessonProgressScope;
  userId: number;
}): Promise<PublishedLessonProgressRow[]> {
  if ("courseId" in scope) {
    return queryPublishedLessonProgressRowsForCourse({
      courseId: scope.courseId,
      userId,
    });
  }

  if ("chapterId" in scope) {
    return queryPublishedLessonProgressRowsForChapter({
      chapterId: scope.chapterId,
      userId,
    });
  }

  return queryPublishedLessonProgressRowsForLesson({
    lessonId: scope.lessonId,
    userId,
  });
}

/**
 * Course-level progress still needs empty published chapters so chapter lists
 * can return zero totals instead of dropping rows from the UI entirely.
 */
export async function listPublishedChaptersForCourse({
  courseId,
}: {
  courseId: number;
}): Promise<{ chapterId: number }[]> {
  const { data } = await safeAsync(() =>
    prisma.chapter.findMany({
      orderBy: { position: "asc" },
      select: { id: true },
      where: {
        archivedAt: null,
        courseId,
        isPublished: true,
      },
    }),
  );

  return (data ?? []).map((chapter) => ({ chapterId: chapter.id }));
}

/**
 * Course pages need the full current lesson tree, plus direct activity counts
 * for the active learner, to derive effective lesson completion consistently.
 */
async function queryPublishedLessonProgressRowsForCourse({
  courseId,
  userId,
}: {
  courseId: number;
  userId: number;
}) {
  const { data } = await safeAsync(
    () =>
      prisma.$queryRaw<PublishedLessonProgressRow[]>`
        SELECT
          o.slug AS "brandSlug",
          ch.id AS "chapterId",
          ch.position AS "chapterPosition",
          ch.slug AS "chapterSlug",
          COUNT(DISTINCT ap.activity_id)::int AS "completedActivities",
          c.id AS "courseId",
          c.slug AS "courseSlug",
          l.description AS "lessonDescription",
          l.generation_status AS "lessonGenerationStatus",
          l.id AS "lessonId",
          l.position AS "lessonPosition",
          l.slug AS "lessonSlug",
          l.title AS "lessonTitle",
          COUNT(DISTINCT CASE WHEN a.generation_status <> 'completed' THEN a.id END)::int AS "pendingActivities",
          COUNT(DISTINCT a.id)::int AS "totalActivities"
        FROM lessons l
        JOIN chapters ch
          ON ch.id = l.chapter_id
          AND ch.is_published = true
          AND ch.archived_at IS NULL
        JOIN courses c
          ON c.id = ch.course_id
          AND c.is_published = true
          AND c.archived_at IS NULL
        LEFT JOIN organizations o ON o.id = c.organization_id
        LEFT JOIN activities a
          ON a.lesson_id = l.id
          AND a.is_published = true
          AND a.archived_at IS NULL
        LEFT JOIN activity_progress ap
          ON ap.activity_id = a.id
          AND ap.user_id = ${userId}
          AND ap.completed_at IS NOT NULL
        WHERE l.is_published = true
          AND l.archived_at IS NULL
          AND c.id = ${courseId}
        GROUP BY o.slug, ch.id, c.id, l.id
        ORDER BY ch.position ASC, l.position ASC
      `,
  );

  return data ?? [];
}

/**
 * Chapter pages reuse the same lesson snapshot shape as course pages, but they
 * constrain the query so lesson lists do not load unrelated chapters.
 */
async function queryPublishedLessonProgressRowsForChapter({
  chapterId,
  userId,
}: {
  chapterId: number;
  userId: number;
}) {
  const { data } = await safeAsync(
    () =>
      prisma.$queryRaw<PublishedLessonProgressRow[]>`
        SELECT
          o.slug AS "brandSlug",
          ch.id AS "chapterId",
          ch.position AS "chapterPosition",
          ch.slug AS "chapterSlug",
          COUNT(DISTINCT ap.activity_id)::int AS "completedActivities",
          c.id AS "courseId",
          c.slug AS "courseSlug",
          l.description AS "lessonDescription",
          l.generation_status AS "lessonGenerationStatus",
          l.id AS "lessonId",
          l.position AS "lessonPosition",
          l.slug AS "lessonSlug",
          l.title AS "lessonTitle",
          COUNT(DISTINCT CASE WHEN a.generation_status <> 'completed' THEN a.id END)::int AS "pendingActivities",
          COUNT(DISTINCT a.id)::int AS "totalActivities"
        FROM lessons l
        JOIN chapters ch
          ON ch.id = l.chapter_id
          AND ch.is_published = true
          AND ch.archived_at IS NULL
        JOIN courses c
          ON c.id = ch.course_id
          AND c.is_published = true
          AND c.archived_at IS NULL
        LEFT JOIN organizations o ON o.id = c.organization_id
        LEFT JOIN activities a
          ON a.lesson_id = l.id
          AND a.is_published = true
          AND a.archived_at IS NULL
        LEFT JOIN activity_progress ap
          ON ap.activity_id = a.id
          AND ap.user_id = ${userId}
          AND ap.completed_at IS NOT NULL
        WHERE l.is_published = true
          AND l.archived_at IS NULL
          AND ch.id = ${chapterId}
        GROUP BY o.slug, ch.id, c.id, l.id
        ORDER BY ch.position ASC, l.position ASC
      `,
  );

  return data ?? [];
}

/**
 * Lesson pages need the same per-lesson progress row shape as higher-level
 * screens so activity indicators and continue buttons can reuse one definition.
 */
async function queryPublishedLessonProgressRowsForLesson({
  lessonId,
  userId,
}: {
  lessonId: number;
  userId: number;
}) {
  const { data } = await safeAsync(
    () =>
      prisma.$queryRaw<PublishedLessonProgressRow[]>`
        SELECT
          o.slug AS "brandSlug",
          ch.id AS "chapterId",
          ch.position AS "chapterPosition",
          ch.slug AS "chapterSlug",
          COUNT(DISTINCT ap.activity_id)::int AS "completedActivities",
          c.id AS "courseId",
          c.slug AS "courseSlug",
          l.description AS "lessonDescription",
          l.generation_status AS "lessonGenerationStatus",
          l.id AS "lessonId",
          l.position AS "lessonPosition",
          l.slug AS "lessonSlug",
          l.title AS "lessonTitle",
          COUNT(DISTINCT CASE WHEN a.generation_status <> 'completed' THEN a.id END)::int AS "pendingActivities",
          COUNT(DISTINCT a.id)::int AS "totalActivities"
        FROM lessons l
        JOIN chapters ch
          ON ch.id = l.chapter_id
          AND ch.is_published = true
          AND ch.archived_at IS NULL
        JOIN courses c
          ON c.id = ch.course_id
          AND c.is_published = true
          AND c.archived_at IS NULL
        LEFT JOIN organizations o ON o.id = c.organization_id
        LEFT JOIN activities a
          ON a.lesson_id = l.id
          AND a.is_published = true
          AND a.archived_at IS NULL
        LEFT JOIN activity_progress ap
          ON ap.activity_id = a.id
          AND ap.user_id = ${userId}
          AND ap.completed_at IS NOT NULL
        WHERE l.is_published = true
          AND l.archived_at IS NULL
          AND l.id = ${lessonId}
        GROUP BY o.slug, ch.id, c.id, l.id
        ORDER BY ch.position ASC, l.position ASC
      `,
  );

  return data ?? [];
}
