import "server-only";
import { type TransactionClient, prisma, sql } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { oweFollowUps } from "../follow-ups/owe-follow-ups";
import { findActiveGoalId } from "../goals/_utils/goal-view";
import { type FinishedChapter } from "../sessions/completion-contract";
import { chapterLessonStats } from "./_utils/chapter-lesson-stats";
import { MIND_MAP_STALE_AFTER_MS } from "./_utils/mind-map-view";
import { planChapters } from "./_utils/plan-chapters";

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

  const touched = [...planItemIds];

  const goals = sql`g.id IN (
    SELECT p.goal_id FROM plan_items i JOIN plans p ON p.id = i.plan_id
    WHERE i.id = ANY(${touched}::uuid[])
  )`;

  const rows = await tx.$queryRaw<FinishedChapterRow[]>`
    SELECT
      pc.chapter_id AS "chapterId",
      pc.goal_id AS "goalId",
      c.title,
      stats.written AND stats.to_write = 0 AND NOT EXISTS (
        SELECT 1 FROM chapter_mind_maps mm
        WHERE mm.chapter_id = pc.chapter_id
          AND (mm.status = 'completed' OR (mm.status = 'running' AND mm.updated_at > ${staleBefore}))
      ) AS "owesMap"
    FROM (${planChapters(goals)}) pc
    JOIN goals g ON g.id = pc.goal_id
    JOIN library_chapters c ON c.id = pc.chapter_id
      AND (c.visibility = 'public' OR c.owner_id = g.user_id)
    CROSS JOIN LATERAL (${chapterLessonStats(sql`pc.chapter_id`)}) stats
    WHERE pc.finished AND pc.item_ids && ${touched}::uuid[]
      AND g.kind <> 'language' AND c.target_language IS NULL
    ORDER BY pc.goal_id, pc.plan_position`;

  await oweFollowUps({
    db: tx,
    followUps: rows.flatMap(({ chapterId, goalId, owesMap }) =>
      owesMap ? [{ input: { chapterId, goalId }, kind: "makeChapterMindMap" as const }] : [],
    ),
    userId,
  });

  return rows.map(({ chapterId, goalId, title }) => ({ chapterId, goalId, title }));
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
 * For a write that completed a lesson's plan items, a replay's included: settles every chapter it
 * finished, in any of the learner's goals, and records on the lesson's learning event the one it
 * reports, which must be in the goal being studied: the session's (`goalId`), else the active one.
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

  if (finished.length === 0) {
    return;
  }

  const studied = goalId ?? (await findActiveGoalId(userId));
  const chapter = finished.find((candidate) => candidate.goalId === studied) ?? null;

  await recordFinishedChapter(tx, { chapter, eventId });
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
