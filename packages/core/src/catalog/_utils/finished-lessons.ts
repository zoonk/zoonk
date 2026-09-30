import "server-only";
import { prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getUserProgressCacheTag } from "../../cache/tags";
import { getSession } from "../../users/get-session";

/**
 * The lessons a learner finished, from their own ledger rows only: a lesson is finished once a
 * first completion or a replay that names it has ended. Callers intersect these ids with an
 * outline in code, so progress never joins content and survives content being regenerated.
 */
export async function listFinishedLessonIds(userId: string): Promise<Set<string>> {
  const rows = await prisma.$queryRaw<{ lessonId: string }[]>`
    SELECT DISTINCT content_ids->>'lessonId' AS "lessonId"
    FROM learning_events
    WHERE user_id = ${userId}::uuid
      AND kind IN ('lesson', 'review')
      AND ended_at IS NOT NULL
      AND content_ids->>'lessonId' IS NOT NULL`;

  return new Set(rows.map((row) => row.lessonId));
}

/**
 * The signed-in learner's (or guest's) finished lessons, tagging the private read so finishing a
 * lesson refreshes it. Without a session nobody has finished anything.
 */
export async function loadViewerFinishedLessons(): Promise<{
  finishedLessonIds: Set<string>;
  signedIn: boolean;
}> {
  const session = await getSession();

  if (!session) {
    return { finishedLessonIds: new Set(), signedIn: false };
  }

  cacheTag(getUserProgressCacheTag(session.user.id));

  return { finishedLessonIds: await listFinishedLessonIds(session.user.id), signedIn: true };
}
