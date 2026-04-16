import { type TransactionClient } from "@zoonk/db";
import {
  getActivityCurriculumContext,
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
  isCurrentLessonCompleted,
} from "./durable-curriculum-completion-rules";

/**
 * Durable completion is append-only and intentionally does not copy or rewrite
 * raw activity progress rows. It simply adds lesson, chapter, and course
 * completion rows once the current published curriculum crosses a completion
 * boundary for the learner during a normal completion write.
 */
export async function syncDurableCurriculumCompletion(
  tx: TransactionClient,
  params: {
    activityId: string;
    userId: string;
  },
): Promise<{ courseId: string }> {
  const context = await getActivityCurriculumContext({ activityId: params.activityId, tx });

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
      durableLessonIds,
      lessonRow,
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
  durableLessonIds,
  lessonRow,
  tx,
  userId,
}: {
  chapterCompleted: boolean;
  context: Awaited<ReturnType<typeof getActivityCurriculumContext>>;
  courseCompleted: boolean;
  durableChapterIds: Set<string>;
  durableLessonIds: Set<string>;
  lessonRow: NonNullable<ReturnType<typeof getLessonRow>>;
  tx: TransactionClient;
  userId: string;
}) {
  return [
    ...(isCurrentLessonCompleted({ row: lessonRow }) && !durableLessonIds.has(context.lessonId)
      ? [
          tx.lessonCompletion.upsert({
            create: {
              lessonId: context.lessonId,
              userId,
            },
            update: {},
            where: {
              userLessonCompletion: {
                lessonId: context.lessonId,
                userId,
              },
            },
          }),
        ]
      : []),
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
