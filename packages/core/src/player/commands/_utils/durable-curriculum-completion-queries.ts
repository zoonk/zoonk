import { type TransactionClient, getPublishedLessonWhere } from "@zoonk/db";
import { getReadableCourseWhere } from "../../../courses/course-access";
import { OPTIONAL_LESSON_KINDS } from "../../../courses/learning-plan-contract";
import { getLessonKindExclusionSql } from "../../../lessons/lesson-kind-exclusions";

type LessonCurriculumContext = {
  chapterId: string;
  courseId: string;
  lessonId: string;
  curriculumVersion: number;
  format: string;
};

export type PublishedLessonCompletionRow = {
  chapterId: string;
  isCompleted: boolean;
  lessonId: string;
};

/**
 * Completion sync re-checks the published curriculum tree inside the write
 * transaction. This prevents raw lesson ids from creating durable progress for
 * draft courses, draft chapters, or draft lessons.
 */
export async function getLessonCurriculumContext({
  lessonId,
  tx,
  userId,
}: {
  lessonId: string;
  tx: TransactionClient;
  userId: string;
}): Promise<LessonCurriculumContext> {
  const lesson = await tx.lesson.findFirst({
    include: { chapter: { include: { course: true } } },
    where: getPublishedLessonWhere({
      courseWhere: getReadableCourseWhere(userId),
      lessonWhere: { id: lessonId },
    }),
  });

  if (!lesson) {
    throw new Error("Lesson is not completable");
  }

  return {
    chapterId: lesson.chapterId,
    courseId: lesson.chapter.courseId,
    curriculumVersion: lesson.chapter.course.curriculumVersion,
    format: lesson.chapter.course.format,
    lessonId: lesson.id,
  };
}

/**
 * Durable completion writes need one current course snapshot with direct
 * lesson completion flags for the learner. Keeping that in one query avoids
 * reloading overlapping trees for lesson, chapter, and course checks.
 */
export async function listPublishedCourseLessonCompletionRows({
  courseId,
  tx,
  userId,
}: {
  courseId: string;
  tx: TransactionClient;
  userId: string;
}): Promise<PublishedLessonCompletionRow[]> {
  const requiredLessonFilter = getLessonKindExclusionSql({
    excludedLessonKinds: [...OPTIONAL_LESSON_KINDS],
  });

  return tx.$queryRaw<PublishedLessonCompletionRow[]>`
    SELECT
      l.chapter_id AS "chapterId",
      (lp.completed_at IS NOT NULL) AS "isCompleted",
      l.id AS "lessonId"
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
      AND lp.user_id = ${userId}
    WHERE c.id = ${courseId}
      AND l.is_published = true
      AND ${requiredLessonFilter}
      AND ((c.user_id IS NULL AND o.kind = 'brand') OR (c.organization_id IS NULL AND c.user_id = ${userId}))
  `;
}

/**
 * Course completion still needs empty published chapters so the learner does
 * not earn a durable course badge before every visible chapter has at least
 * some lesson content to finish.
 */
export async function listPublishedCourseChapters({
  courseId,
  tx,
}: {
  courseId: string;
  tx: TransactionClient;
}) {
  return tx.chapter.findMany({
    orderBy: { position: "asc" },
    where: { course: { isPublished: true }, courseId, isPublished: true },
  });
}

/**
 * Completed lessons need to be loaded for the same published course tree we
 * are evaluating now so chapter and course rollups use the current catalog.
 */
export async function listDurableCourseLessonIds({
  courseId,
  tx,
  userId,
}: {
  courseId: string;
  tx: TransactionClient;
  userId: string;
}): Promise<Set<string>> {
  const rows = await tx.lessonProgress.findMany({
    where: {
      completedAt: { not: null },
      lesson: {
        chapter: { course: { isPublished: true }, courseId, isPublished: true },
        isPublished: true,
      },
      userId,
    },
  });

  return new Set(rows.flatMap((row) => (row.lessonId ? [row.lessonId] : [])));
}

/**
 * Durable chapter completions follow the same rule as lessons: only chapters
 * from the current published course tree matter while we decide whether the
 * course itself just crossed the completion boundary.
 */
export async function listDurableCourseChapterIds({
  courseId,
  tx,
  userId,
}: {
  courseId: string;
  tx: TransactionClient;
  userId: string;
}): Promise<Set<string>> {
  const rows = await tx.chapterCompletion.findMany({
    where: { chapter: { course: { isPublished: true }, courseId, isPublished: true }, userId },
  });

  return new Set(rows.flatMap((row) => (row.chapterId ? [row.chapterId] : [])));
}
