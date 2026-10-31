import "server-only";
import { prisma, sql } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getUserProgressCacheTag } from "../../cache/tags";
import { getSession } from "../../users/get-session";

async function findFinishedLessonIds({
  lessonIds,
  userId,
}: {
  lessonIds?: readonly string[];
  userId: string;
}): Promise<Set<string>> {
  if (lessonIds?.length === 0) {
    return new Set();
  }

  /** Containment uses the JSONB index while allowing other snapshot ids on the same event. */
  const requestedLessons = lessonIds
    ? sql`AND content_ids @> ANY(${lessonIds.map((lessonId) => JSON.stringify({ lessonId }))}::jsonb[])`
    : sql``;

  const rows = await prisma.$queryRaw<{ lessonId: string }[]>`
    SELECT DISTINCT content_ids->>'lessonId' AS "lessonId"
    FROM learning_events
    WHERE user_id = ${userId}::uuid
      AND kind IN ('lesson', 'review')
      AND ended_at IS NOT NULL
      AND content_ids->>'lessonId' IS NOT NULL
      ${requestedLessons}`;

  return new Set(rows.map((row) => row.lessonId));
}

export function listFinishedLessonIds(userId: string): Promise<Set<string>> {
  return findFinishedLessonIds({ userId });
}

export async function loadViewerFinishedLessons(
  lessonIds: readonly string[],
): Promise<{ finishedLessonIds: Set<string>; signedIn: boolean }> {
  const session = await getSession();

  if (!session) {
    return { finishedLessonIds: new Set(), signedIn: false };
  }

  cacheTag(getUserProgressCacheTag(session.user.id));

  return {
    finishedLessonIds: await findFinishedLessonIds({ lessonIds, userId: session.user.id }),
    signedIn: true,
  };
}
