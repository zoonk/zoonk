import "server-only";
import { type StudySessionStatus, prisma } from "@zoonk/db";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";

/** Ended days retain their history; only running or future days follow changes. */
const OPEN_SESSION_STATUSES: StudySessionStatus[] = ["planned", "active"];

async function loadItemLessonIds(planItemIds: readonly string[]): Promise<string[]> {
  const items = await prisma.planItem.findMany({
    select: { chapterId: true, lessonId: true },
    where: { id: { in: [...planItemIds] } },
  });

  const chapterIds = items.flatMap((item) => (item.lessonId ? [] : (item.chapterId ?? [])));

  const chapterLessons =
    chapterIds.length > 0
      ? await prisma.chapterLesson.findMany({
          select: { lessonId: true },
          where: { chapterId: { in: chapterIds } },
        })
      : [];

  return [
    ...new Set([
      ...items.flatMap((item) => item.lessonId ?? []),
      ...chapterLessons.map((row) => row.lessonId),
    ]),
  ];
}

/** Skips tested-out lessons in open sessions; notStarted also removes pending blocks without rebuilding the rest. */
export async function skipTestedOutBlocks({
  goalId,
  notStarted = false,
  planItemIds,
}: {
  goalId: string;
  /** Skips the settled lessons' blocks not started yet too: the rest of the day stays as it is. */
  notStarted?: boolean;
  planItemIds: readonly string[];
}): Promise<void> {
  const [goal, lessonIds] = await Promise.all([
    prisma.goal.findUnique({ where: { id: goalId } }),
    loadItemLessonIds(planItemIds),
  ]);

  if (!goal || lessonIds.length === 0) {
    return;
  }

  await writeLearnerChange({ userId: goal.userId }, async (tx) => {
    // Match queue writers' block-lock order rather than relying on UPDATE scan order.
    const blocks = await tx.$queryRaw<{ id: string }[]>`
      SELECT block.id FROM study_session_blocks AS block
      JOIN study_sessions AS session ON session.id = block.session_id
      WHERE block.kind = 'learn' AND block.lesson_id = ANY(${lessonIds}::uuid[])
        AND session.goal_id = ${goalId}::uuid AND session.status IN ('planned', 'active')
        AND (block.status = 'active' OR (${notStarted} AND block.status = 'pending'))
      ORDER BY block.id FOR UPDATE OF block
    `;

    if (blocks.length === 0) {
      return unchanged(null);
    }

    const updated = await tx.studySessionBlock.updateMany({
      data: { status: "skipped" },
      where: {
        id: { in: blocks.map((block) => block.id) },
        kind: "learn",
        lessonId: { in: lessonIds },
        session: { goalId, status: { in: OPEN_SESSION_STATUSES } },
        status: { in: notStarted ? ["active", "pending"] : ["active"] },
      },
    });

    if (updated.count === 0) {
      return unchanged(null);
    }
  });
}
