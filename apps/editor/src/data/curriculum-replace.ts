import "server-only";
import { type ContentDeleteTarget, getContentDeleteDecision } from "@zoonk/core/content/lifecycle";
import {
  type Activity,
  type Chapter,
  type Lesson,
  type TransactionClient,
  getActiveActivityWhere,
  getActiveChapterWhere,
  getActiveLessonWhere,
} from "@zoonk/db";
import { getArchivedSlug } from "./curriculum-delete";

type ReplaceDecision<Item> = {
  item: Item;
  mode: "archive" | "hardDelete";
};

/**
 * Replace-mode imports need to retire the current active curriculum branch
 * without erasing learner history. This helper centralizes the archive-vs-delete
 * split so chapter imports, lesson imports, and activity imports all follow the
 * same lifecycle rule before they create the replacement rows.
 */
async function getReplaceDecisions<Item>({
  getTarget,
  items,
}: {
  getTarget: (item: Item) => ContentDeleteTarget;
  items: Item[];
}): Promise<ReplaceDecision<Item>[]> {
  return Promise.all(
    items.map(async (item) => {
      const decision = await getContentDeleteDecision(getTarget(item));

      return {
        item,
        mode: decision.mode,
      };
    }),
  );
}

/**
 * Hard deletes should stay batched because untouched rows do not need any
 * per-record lifecycle work. This keeps replace-mode imports efficient while
 * still letting archive paths do the extra slug rewrite work they need.
 */
async function deleteChapters({ chapterIds, tx }: { chapterIds: string[]; tx: TransactionClient }) {
  if (chapterIds.length === 0) {
    return;
  }

  await tx.chapter.deleteMany({
    where: { id: { in: chapterIds } },
  });
}

/**
 * Archived chapters must release their public slug immediately so a replacement
 * import can reuse that slug without touching the database uniqueness rules.
 */
async function archiveChapters({ chapters, tx }: { chapters: Chapter[]; tx: TransactionClient }) {
  if (chapters.length === 0) {
    return;
  }

  const archivedAt = new Date();

  await Promise.all(
    chapters.map((chapter) =>
      tx.chapter.update({
        data: {
          archivedAt,
          slug: getArchivedSlug({
            id: chapter.id,
            slug: chapter.slug,
          }),
        },
        where: { id: chapter.id },
      }),
    ),
  );
}

/**
 * Lesson replace imports follow the same historical-integrity rule as chapter
 * imports, including slug release for archived rows.
 */
async function deleteLessons({ lessonIds, tx }: { lessonIds: string[]; tx: TransactionClient }) {
  if (lessonIds.length === 0) {
    return;
  }

  await tx.lesson.deleteMany({
    where: { id: { in: lessonIds } },
  });
}

/**
 * Archived lessons also need slug release because lesson routes and future
 * imports should treat archived content as retired, not as a permanent slug
 * reservation.
 */
async function archiveLessons({ lessons, tx }: { lessons: Lesson[]; tx: TransactionClient }) {
  if (lessons.length === 0) {
    return;
  }

  const archivedAt = new Date();

  await Promise.all(
    lessons.map((lesson) =>
      tx.lesson.update({
        data: {
          archivedAt,
          slug: getArchivedSlug({
            id: lesson.id,
            slug: lesson.slug,
          }),
        },
        where: { id: lesson.id },
      }),
    ),
  );
}

/**
 * Activities do not have public slugs, so their archive path only needs to keep
 * the row and mark it inactive. That preserves attempts and completions without
 * the extra rewrite work chapters and lessons need.
 */
async function deleteActivities({
  activityIds,
  tx,
}: {
  activityIds: string[];
  tx: TransactionClient;
}) {
  if (activityIds.length === 0) {
    return;
  }

  await tx.activity.deleteMany({
    where: { id: { in: activityIds } },
  });
}

/**
 * Activity archives happen in bulk because there is no per-record slug state to
 * preserve. The archived timestamp is still enough to hide them from the active
 * curriculum and keep learner history intact.
 */
async function archiveActivities({
  activities,
  tx,
}: {
  activities: Activity[];
  tx: TransactionClient;
}) {
  if (activities.length === 0) {
    return;
  }

  await tx.activity.updateMany({
    data: { archivedAt: new Date() },
    where: { id: { in: activities.map((activity) => activity.id) } },
  });
}

/**
 * Chapter replace imports should only retire the chapters that still belong to
 * the active curriculum. Archived rows are already out of the editor contract
 * and should not be touched again during a normal import.
 */
export async function replaceCourseChapters({
  courseId,
  tx,
}: {
  courseId: string;
  tx: TransactionClient;
}) {
  const chapters = await tx.chapter.findMany({
    where: getActiveChapterWhere({
      chapterWhere: { courseId },
    }),
  });
  const decisions = await getReplaceDecisions({
    getTarget: (chapter) => ({ chapter, entityType: "chapter" }),
    items: chapters,
  });

  const chaptersToArchive = decisions
    .filter((decision) => decision.mode === "archive")
    .map((decision) => decision.item);

  const chapterIdsToDelete = decisions
    .filter((decision) => decision.mode === "hardDelete")
    .map((decision) => decision.item.id);

  await Promise.all([
    archiveChapters({ chapters: chaptersToArchive, tx }),
    deleteChapters({ chapterIds: chapterIdsToDelete, tx }),
  ]);
}

/**
 * Lesson replace imports should apply the same lifecycle rule as chapter
 * replaces so learner-touched lessons are retired, not erased.
 */
export async function replaceChapterLessons({
  chapterId,
  tx,
}: {
  chapterId: string;
  tx: TransactionClient;
}) {
  const lessons = await tx.lesson.findMany({
    where: getActiveLessonWhere({
      lessonWhere: { chapterId },
    }),
  });

  const decisions = await getReplaceDecisions({
    getTarget: (lesson) => ({ entityType: "lesson", lesson }),
    items: lessons,
  });

  const lessonsToArchive = decisions
    .filter((decision) => decision.mode === "archive")
    .map((decision) => decision.item);

  const lessonIdsToDelete = decisions
    .filter((decision) => decision.mode === "hardDelete")
    .map((decision) => decision.item.id);

  await Promise.all([
    archiveLessons({ lessons: lessonsToArchive, tx }),
    deleteLessons({ lessonIds: lessonIdsToDelete, tx }),
  ]);
}

/**
 * Activity replace imports also operate on active rows only. Archived activities
 * are already retired and should not affect the next replacement import.
 */
export async function replaceLessonActivities({
  lessonId,
  tx,
}: {
  lessonId: string;
  tx: TransactionClient;
}) {
  const activities = await tx.activity.findMany({
    where: getActiveActivityWhere({
      activityWhere: { lessonId },
    }),
  });
  const decisions = await getReplaceDecisions({
    getTarget: (activity) => ({ activity, entityType: "activity" }),
    items: activities,
  });

  const activitiesToArchive = decisions
    .filter((decision) => decision.mode === "archive")
    .map((decision) => decision.item);

  const activityIdsToDelete = decisions
    .filter((decision) => decision.mode === "hardDelete")
    .map((decision) => decision.item.id);

  await Promise.all([
    archiveActivities({ activities: activitiesToArchive, tx }),
    deleteActivities({ activityIds: activityIdsToDelete, tx }),
  ]);
}
