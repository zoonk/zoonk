import { type TransactionClient } from "@zoonk/db";
import {
  getLessonCurriculumContext,
  listDurableCourseChapterIds,
  listDurableCourseLessonIds,
  listPublishedCourseChapters,
  listPublishedCourseLessonCompletionRows,
} from "./durable-curriculum-completion-queries";
import {
  getEffectiveDurableChapterIds,
  getEffectiveDurableLessonIds,
  getLessonRow,
  groupRowsByChapter,
  isCurrentChapterCompleted,
  isCurrentCourseCompleted,
} from "./durable-curriculum-completion-rules";

/**
 * Completion rollups are derived from lesson progress and append-only chapter
 * and course rows once the current published curriculum crosses a boundary.
 */
export async function syncDurableCurriculumCompletion(
  tx: TransactionClient,
  params: {
    lessonId: string;
    userId: string;
  },
): Promise<{ courseId: string }> {
  const context = await getLessonCurriculumContext({ lessonId: params.lessonId, tx });

  const [chapters, rows, durableLessonIds, durableChapterIds] = await Promise.all([
    listPublishedCourseChapters({ courseId: context.courseId, tx }),
    listPublishedCourseLessonCompletionRows({
      courseId: context.courseId,
      tx,
      userId: params.userId,
    }),
    listDurableCourseLessonIds({ courseId: context.courseId, tx, userId: params.userId }),
    listDurableCourseChapterIds({ courseId: context.courseId, tx, userId: params.userId }),
  ]);

  const lessonRow = getLessonRow({ lessonId: context.lessonId, rows });

  if (!lessonRow) {
    return { courseId: context.courseId };
  }

  const effectiveDurableLessonIds = getEffectiveDurableLessonIds({
    durableLessonIds,
    lessonRow,
  });

  const rowsByChapter = groupRowsByChapter({ rows });

  const chapterCompleted = isCurrentChapterCompleted({
    chapterId: context.chapterId,
    durableLessonIds: effectiveDurableLessonIds,
    rowsByChapter,
  });

  const effectiveDurableChapterIds = getEffectiveDurableChapterIds({
    chapterId: context.chapterId,
    durableChapterIds,
    isChapterCompleted: chapterCompleted,
  });

  const courseCompleted = isCurrentCourseCompleted({
    chapters,
    durableChapterIds: effectiveDurableChapterIds,
    durableLessonIds: effectiveDurableLessonIds,
    rowsByChapter,
  });

  await Promise.all(
    getDurableCompletionWrites({
      chapterCompleted,
      context,
      courseCompleted,
      durableChapterIds,
      tx,
      userId: params.userId,
    }),
  );

  return { courseId: context.courseId };
}

/**
 * Each durable completion write is independent once the course snapshot has
 * already been evaluated. Building the write list separately keeps the main
 * sync flow focused on deriving completion boundaries instead of mixing that
 * reasoning with Prisma mutation details.
 */
function getDurableCompletionWrites({
  chapterCompleted,
  context,
  courseCompleted,
  durableChapterIds,
  tx,
  userId,
}: {
  chapterCompleted: boolean;
  context: Awaited<ReturnType<typeof getLessonCurriculumContext>>;
  courseCompleted: boolean;
  durableChapterIds: Set<string>;
  tx: TransactionClient;
  userId: string;
}) {
  return [
    ...(chapterCompleted && !durableChapterIds.has(context.chapterId)
      ? [
          tx.chapterCompletion.upsert({
            create: {
              chapterId: context.chapterId,
              userId,
            },
            update: {},
            where: {
              userChapterCompletion: {
                chapterId: context.chapterId,
                userId,
              },
            },
          }),
        ]
      : []),
    ...(courseCompleted
      ? [
          tx.courseCompletion.upsert({
            create: {
              courseId: context.courseId,
              userId,
            },
            update: {},
            where: {
              userCourseCompletion: {
                courseId: context.courseId,
                userId,
              },
            },
          }),
        ]
      : []),
  ];
}
