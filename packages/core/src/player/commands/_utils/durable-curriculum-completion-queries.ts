import { type TransactionClient } from "@zoonk/db";

type ActivityCurriculumContext = {
  chapterId: number;
  courseId: number;
  lessonId: number;
};

export type PublishedLessonCompletionRow = {
  chapterId: number;
  completedActivities: number;
  lessonId: number;
  totalActivities: number;
};

/**
 * Completion sync starts from an activity id because that is the only stable
 * input the player action already has. Resolving the lesson, chapter, and
 * course once lets every later completion decision derive from the real
 * curriculum tree instead of trusting caller-provided ids.
 */
export async function getActivityCurriculumContext({
  activityId,
  tx,
}: {
  activityId: bigint;
  tx: TransactionClient;
}): Promise<ActivityCurriculumContext> {
  const activity = await tx.activity.findUnique({
    include: {
      lesson: {
        select: {
          chapter: {
            select: {
              courseId: true,
            },
          },
          chapterId: true,
          id: true,
        },
      },
    },
    where: { id: activityId },
  });

  if (!activity) {
    throw new Error("Activity not found");
  }

  return {
    chapterId: activity.lesson.chapterId,
    courseId: activity.lesson.chapter.courseId,
    lessonId: activity.lesson.id,
  };
}

/**
 * Durable completion writes need one current course snapshot with direct
 * activity completion counts for the learner. Keeping that aggregation in one
 * query avoids reloading overlapping lesson trees for lesson, chapter, and
 * course checks separately.
 */
export async function listPublishedCourseLessonCompletionRows({
  courseId,
  tx,
  userId,
}: {
  courseId: number;
  tx: TransactionClient;
  userId: string;
}): Promise<PublishedLessonCompletionRow[]> {
  return tx.$queryRaw<PublishedLessonCompletionRow[]>`
    SELECT
      l.chapter_id AS "chapterId",
      COUNT(DISTINCT ap.activity_id)::int AS "completedActivities",
      l.id AS "lessonId",
      COUNT(DISTINCT a.id)::int AS "totalActivities"
    FROM lessons l
    JOIN chapters ch
      ON ch.id = l.chapter_id
      AND ch.is_published = true
      AND ch.archived_at IS NULL
    LEFT JOIN activities a
      ON a.lesson_id = l.id
      AND a.is_published = true
      AND a.archived_at IS NULL
    LEFT JOIN activity_progress ap
      ON ap.activity_id = a.id
      AND ap.user_id = ${userId}
      AND ap.completed_at IS NOT NULL
    WHERE ch.course_id = ${courseId}
      AND l.is_published = true
      AND l.archived_at IS NULL
    GROUP BY l.chapter_id, l.id
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
  courseId: number;
  tx: TransactionClient;
}) {
  return tx.chapter.findMany({
    orderBy: { position: "asc" },
    where: {
      archivedAt: null,
      courseId,
      isPublished: true,
    },
  });
}

/**
 * Durable lesson completions need to be loaded for the same published course
 * tree we are evaluating now. Keeping that filter at the database level avoids
 * first loading lesson ids and then issuing a second scoped query from them.
 */
export async function listDurableCourseLessonIds({
  courseId,
  tx,
  userId,
}: {
  courseId: number;
  tx: TransactionClient;
  userId: string;
}): Promise<Set<number>> {
  const rows = await tx.lessonCompletion.findMany({
    where: {
      lesson: {
        archivedAt: null,
        chapter: {
          archivedAt: null,
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
  courseId: number;
  tx: TransactionClient;
  userId: string;
}): Promise<Set<number>> {
  const rows = await tx.chapterCompletion.findMany({
    where: {
      chapter: {
        archivedAt: null,
        courseId,
        isPublished: true,
      },
      userId,
    },
  });

  return new Set(rows.map((row) => row.chapterId));
}
