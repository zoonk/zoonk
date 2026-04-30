import { type TransactionClient } from "@zoonk/db";

type LessonCurriculumContext = {
  chapterId: string;
  courseId: string;
  lessonId: string;
};

export type PublishedLessonCompletionRow = {
  chapterId: string;
  isCompleted: boolean;
  lessonId: string;
};

/**
 * Completion sync starts from a lesson id and resolves the chapter and course
 * once so every later completion decision derives from the curriculum tree.
 */
export async function getLessonCurriculumContext({
  lessonId,
  tx,
}: {
  lessonId: string;
  tx: TransactionClient;
}): Promise<LessonCurriculumContext> {
  const lesson = await tx.lesson.findUnique({
    select: {
      chapter: {
        select: {
          courseId: true,
        },
      },
      chapterId: true,
      id: true,
    },
    where: { id: lessonId },
  });

  if (!lesson) {
    throw new Error("Lesson not found");
  }

  return {
    chapterId: lesson.chapterId,
    courseId: lesson.chapter.courseId,
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
  return tx.$queryRaw<PublishedLessonCompletionRow[]>`
    SELECT
      l.chapter_id AS "chapterId",
      (lp.completed_at IS NOT NULL) AS "isCompleted",
      l.id AS "lessonId"
    FROM lessons l
    JOIN chapters ch
      ON ch.id = l.chapter_id
      AND ch.is_published = true
    LEFT JOIN lesson_progress lp
      ON lp.lesson_id = l.id
      AND lp.user_id = ${userId}
    WHERE ch.course_id = ${courseId}
      AND l.is_published = true
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
    where: {
      courseId,
      isPublished: true,
    },
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
        chapter: {
          courseId,
          isPublished: true,
        },
        isPublished: true,
      },
      userId,
    },
  });

  return new Set(rows.map((row) => row.lessonId));
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
    where: {
      chapter: {
        courseId,
        isPublished: true,
      },
      userId,
    },
  });

  return new Set(rows.map((row) => row.chapterId));
}
