import "server-only";
import { type LessonKind, type Sql, getPublishedLessonWhere, prisma, sql } from "@zoonk/db";
import {
  getLessonKindExclusionSql,
  getLessonKindExclusionWhere,
} from "../lessons/lesson-kind-exclusions";
import { type LessonScope } from "../lessons/lesson-scope";

export type PublishedLessonProgressRow = {
  brandSlug: string | null;
  chapterId: string;
  chapterPosition: number;
  chapterSlug: string;
  chapterTitle: string;
  completedLessons: number;
  courseId: string;
  courseSlug: string;
  lessonDescription: string | null;
  lessonGenerationStatus: "completed" | "failed" | "pending" | "running";
  lessonId: string;
  lessonKind: LessonKind;
  lessonPosition: number;
  lessonSlug: string;
  lessonTitle: string | null;
  pendingLessons: number;
  totalLessons: number;
};

export type PublishedCourseChapter = {
  brandSlug: string;
  chapterId: string;
  chapterPosition: number;
  chapterSlug: string;
  chapterTitle: string;
  courseSlug: string;
};

type ProgressQueryInput = {
  excludedLessonKinds?: LessonKind[];
  scope: LessonScope;
  userId: string | null;
};

/**
 * Loads the published lesson tree and the current learner's direct completion
 * state in one stable row shape. Passing a nullable user id keeps anonymous
 * curriculum reads explicit without consulting request state inside core.
 */
export async function listPublishedLessonProgressRows({
  excludedLessonKinds,
  scope,
  userId,
}: ProgressQueryInput): Promise<PublishedLessonProgressRow[]> {
  const lessonKindFilter = getLessonKindExclusionSql({ excludedLessonKinds });
  const scopeFilter = getPublishedLessonProgressScopeFilter({ scope });
  const progressUserFilter = userId ? sql`lp.user_id = ${userId}` : sql`FALSE`;

  return prisma.$queryRaw<PublishedLessonProgressRow[]>`
    SELECT
      o.slug AS "brandSlug",
      ch.id AS "chapterId",
      ch.position AS "chapterPosition",
      ch.slug AS "chapterSlug",
      ch.title AS "chapterTitle",
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
      AND ${lessonKindFilter}
    GROUP BY o.slug, ch.id, c.id, l.id
    ORDER BY ch.position ASC, l.position ASC
  `;
}

/**
 * Lists every published chapter in course order, including empty chapters.
 * Continuation uses the metadata to identify a pending next chapter, while
 * chapter progress uses the same result to keep zero-lesson chapters visible.
 */
export async function listPublishedCourseChapters({
  courseId,
}: {
  courseId: string;
}): Promise<PublishedCourseChapter[]> {
  const chapters = await prisma.chapter.findMany({
    include: { course: { include: { organization: true } } },
    orderBy: { position: "asc" },
    where: { courseId, isPublished: true },
  });

  return chapters.map((chapter) => ({
    brandSlug: chapter.course.organization?.slug ?? "",
    chapterId: chapter.id,
    chapterPosition: chapter.position,
    chapterSlug: chapter.slug,
    chapterTitle: chapter.title,
    courseSlug: chapter.course.slug,
  }));
}

/**
 * Loads durable chapter completion ids only for chapters represented by the
 * requested visible lesson scope. Matching the published lesson predicate
 * keeps hidden and unpublished curriculum from changing continuation state.
 */
export async function listDurableChapterCompletionIds({
  excludedLessonKinds,
  scope,
  userId,
}: ProgressQueryInput): Promise<string[]> {
  if (!userId) {
    return [];
  }

  const completions = await prisma.chapterCompletion.findMany({
    select: { chapterId: true },
    where: {
      chapter: { lessons: { some: getScopedPublishedLessonWhere({ excludedLessonKinds, scope }) } },
      userId,
    },
  });

  return completions.map((row) => row.chapterId);
}

/**
 * Checks the learner's durable course badge independently from the current
 * lesson tree so a newly published chapter cannot reopen an earned course.
 */
export async function hasDurableCourseCompletion({
  courseId,
  userId,
}: {
  courseId: string;
  userId: string | null;
}): Promise<boolean> {
  if (!userId) {
    return false;
  }

  const completion = await prisma.courseCompletion.findUnique({
    where: { userCourseCompletion: { courseId, userId } },
  });

  return Boolean(completion);
}

/**
 * Builds the published lesson predicate shared by direct and durable progress
 * reads. Keeping scope selection here makes every async leaf evaluate the same
 * course, chapter, or lesson boundary without depending on another query.
 */
function getScopedPublishedLessonWhere({
  excludedLessonKinds,
  scope,
}: Omit<ProgressQueryInput, "userId">) {
  const lessonWhere = getLessonKindExclusionWhere({ excludedLessonKinds });

  if ("courseId" in scope) {
    return getPublishedLessonWhere({ courseWhere: { id: scope.courseId }, lessonWhere });
  }

  if ("chapterId" in scope) {
    return getPublishedLessonWhere({ chapterWhere: { id: scope.chapterId }, lessonWhere });
  }

  return getPublishedLessonWhere({ lessonWhere: { ...lessonWhere, id: scope.lessonId } });
}

/**
 * Raw SQL cannot parameterize column names, so the scope predicate stays
 * explicitly whitelisted to the three supported progress boundaries.
 */
function getPublishedLessonProgressScopeFilter({ scope }: { scope: LessonScope }): Sql {
  if ("courseId" in scope) {
    return sql`c.id = ${scope.courseId}`;
  }

  if ("chapterId" in scope) {
    return sql`ch.id = ${scope.chapterId}`;
  }

  return sql`l.id = ${scope.lessonId}`;
}
