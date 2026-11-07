import "server-only";
import { type TransactionClient, prisma, sql } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { oweFollowUps } from "../follow-ups/owe-follow-ups";
import { findActiveGoalId } from "../goals/_utils/goal-view";
import { type FinishedChapter } from "../sessions/completion-contract";
import { chapterLessonStats } from "./_utils/chapter-lesson-stats";
import { MIND_MAP_STALE_AFTER_MS } from "./_utils/mind-map-view";

type FinishedChapterRow = FinishedChapter & { owesMap: boolean };

/**
 * Pass the write's transaction and the plan items it just marked done or tested out: returns the
 * non-language chapters that write finished, and owes the map of each whose lessons are all written
 * or set aside and that has no map ready or being made. The owe claims nothing; the follow-up asks
 * for the map as a tap does.
 */
export async function settleFinishedChapters(
  tx: TransactionClient,
  { planItemIds, userId }: { planItemIds: readonly string[]; userId: string },
): Promise<FinishedChapter[]> {
  if (planItemIds.length === 0) {
    return [];
  }

  const staleBefore = new Date(Date.now() - MIND_MAP_STALE_AFTER_MS);

  const rows = await tx.$queryRaw<FinishedChapterRow[]>`
    WITH touched AS (
      SELECT DISTINCT i.plan_id, i.chapter_id
      FROM plan_items i
      WHERE i.id = ANY(${[...planItemIds]}::uuid[])
        AND i.chapter_id IS NOT NULL AND i.kind IN ('chapter', 'lesson')
    )
    SELECT
      t.chapter_id AS "chapterId",
      p.goal_id AS "goalId",
      c.title,
      stats.written AND stats.to_write = 0 AND NOT EXISTS (
        SELECT 1 FROM chapter_mind_maps mm
        WHERE mm.chapter_id = t.chapter_id
          AND (mm.status = 'completed' OR (mm.status = 'running' AND mm.updated_at > ${staleBefore}))
      ) AS "owesMap"
    FROM touched t
    JOIN plans p ON p.id = t.plan_id
    JOIN goals g ON g.id = p.goal_id
    JOIN library_chapters c ON c.id = t.chapter_id
    CROSS JOIN LATERAL (${chapterLessonStats(sql`t.chapter_id`)}) stats
    WHERE g.kind <> 'language' AND c.target_language IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM plan_items o
        WHERE o.plan_id = t.plan_id AND o.chapter_id = t.chapter_id
          AND o.kind IN ('chapter', 'lesson') AND o.status NOT IN ('done', 'tested_out')
      )
    ORDER BY p.goal_id, t.chapter_id`;

  await oweFollowUps({
    db: tx,
    followUps: rows.flatMap(({ chapterId, goalId, owesMap }) =>
      owesMap ? [{ input: { chapterId, goalId }, kind: "makeChapterMindMap" as const }] : [],
    ),
    userId,
  });

  return rows.map(({ chapterId, goalId, title }) => ({ chapterId, goalId, title }));
}

/** The chapter a completion reports: the one in its own goal, or the first it finished. */
function pickFinishedChapter({
  finished,
  goalId,
}: {
  finished: readonly FinishedChapter[];
  goalId: string | null;
}): FinishedChapter | null {
  return finished.find((chapter) => chapter.goalId === goalId) ?? finished[0] ?? null;
}

/** For a completion's learning event, so its retries report the same finish. */
export function toFinishedChapterIds(chapter: FinishedChapter | null): Record<string, string> {
  return chapter ? { finishedChapterId: chapter.chapterId, finishedGoalId: chapter.goalId } : {};
}

async function recordFinishedChapter(
  tx: TransactionClient,
  { chapter, eventId }: { chapter: FinishedChapter | null; eventId: string },
): Promise<void> {
  if (!chapter) {
    return;
  }

  const event = await tx.learningEvent.findUniqueOrThrow({
    select: { contentIds: true },
    where: { id: eventId },
  });

  await tx.learningEvent.update({
    data: {
      contentIds: {
        ...(isJsonObject(event.contentIds) ? event.contentIds : {}),
        ...toFinishedChapterIds(chapter),
      },
    },
    where: { id: eventId },
  });
}

/**
 * For a write that completed a lesson's plan items: settles the chapters it finished and records the
 * one it reports on the lesson's learning event. `goalId` is the session's goal, when there is one.
 */
export async function finishLessonChapters(
  tx: TransactionClient,
  {
    eventId,
    goalId,
    planItemIds,
    userId,
  }: { eventId: string; goalId: string | null; planItemIds: readonly string[]; userId: string },
): Promise<void> {
  const finished = await settleFinishedChapters(tx, { planItemIds, userId });
  const ownGoalId = goalId ?? (finished.length > 1 ? await findActiveGoalId(userId) : null);

  await recordFinishedChapter(tx, {
    chapter: pickFinishedChapter({ finished, goalId: ownGoalId }),
    eventId,
  });
}

/** Reads the finish a learning event recorded, with the chapter's title as it is now. */
export async function readFinishedChapter(contentIds: unknown): Promise<FinishedChapter | null> {
  const content = isJsonObject(contentIds) ? contentIds : {};
  const { finishedChapterId: chapterId, finishedGoalId: goalId } = content;

  if (typeof chapterId !== "string" || typeof goalId !== "string") {
    return null;
  }

  const chapter = await prisma.chapter.findUnique({
    select: { title: true },
    where: { id: chapterId },
  });

  return chapter ? { chapterId, goalId, title: chapter.title } : null;
}
