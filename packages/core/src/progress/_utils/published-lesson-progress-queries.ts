import "server-only";
import { type Sql, prisma, sql } from "@zoonk/db";
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
  userId?: string;
}): Promise<PublishedLessonProgressRow[]> {
  return queryPublishedLessonProgressRows({
    scope,
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
  courseId: string;
}): Promise<{ chapterId: string }[]> {
  const { data } = await safeAsync(() =>
    prisma.chapter.findMany({
      orderBy: { position: "asc" },
      select: { id: true },
      where: {
        courseId,
        isPublished: true,
      },
    }),
  );

  return (data ?? []).map((chapter) => ({ chapterId: chapter.id }));
}

/**
 * Course, chapter, and player pages all need the same published progress row
 * shape. The only difference is which scope boundary trims the live lesson
 * tree, so this helper keeps one SQL statement and swaps only a whitelisted
 * predicate for the requested scope.
 */
async function queryPublishedLessonProgressRows({
  scope,
  userId,
}: {
  scope: PublishedLessonProgressScope;
  userId?: string;
}) {
  const scopeFilter = getPublishedLessonProgressScopeFilter({ scope });
  const progressUserFilter = userId ? sql`lp.user_id = ${userId}` : sql`FALSE`;

  const { data } = await safeAsync(
    () =>
      prisma.$queryRaw<PublishedLessonProgressRow[]>`
        SELECT
          o.slug AS "brandSlug",
          ch.id AS "chapterId",
          ch.position AS "chapterPosition",
          ch.slug AS "chapterSlug",
          COUNT(lp.lesson_id)::int AS "completedLessons",
          c.id AS "courseId",
          c.slug AS "courseSlug",
          l.description AS "lessonDescription",
          l.generation_status AS "lessonGenerationStatus",
          l.id AS "lessonId",
          l.kind AS "lessonKind",
          l.position AS "lessonPosition",
          l.slug AS "lessonSlug",
          l.title AS "lessonTitle",
          CASE WHEN l.generation_status <> 'completed' THEN 1 ELSE 0 END AS "pendingLessons",
          1 AS "totalLessons"
        FROM lessons l
        JOIN chapters ch
          ON ch.id = l.chapter_id
          AND ch.is_published = true
        JOIN courses c
          ON c.id = ch.course_id
          AND c.is_published = true
        LEFT JOIN organizations o ON o.id = c.organization_id
        LEFT JOIN lesson_progress lp
          ON lp.lesson_id = l.id
          AND ${progressUserFilter}
          AND lp.completed_at IS NOT NULL
        WHERE l.is_published = true
          AND ${scopeFilter}
        GROUP BY o.slug, ch.id, c.id, l.id
        ORDER BY ch.position ASC, l.position ASC
      `,
  );

  return data ?? [];
}

/**
 * Raw SQL cannot parameterize column names, so the scope predicate must stay
 * explicitly whitelisted here. Limiting this helper to the three supported
 * scope shapes keeps the shared query safe while still removing the duplicated
 * SQL body above.
 */
function getPublishedLessonProgressScopeFilter({
  scope,
}: {
  scope: PublishedLessonProgressScope;
}): Sql {
  if ("courseId" in scope) {
    return sql`c.id = ${scope.courseId}`;
  }

  if ("chapterId" in scope) {
    return sql`ch.id = ${scope.chapterId}`;
  }

  return sql`l.id = ${scope.lessonId}`;
}
