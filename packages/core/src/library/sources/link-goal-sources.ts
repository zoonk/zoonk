import "server-only";
import { type LearnerSourceOrigin, type TransactionClient } from "@zoonk/db";

/**
 * The only writer of a goal's sources, inside the caller's learner write: links the goal only to
 * the learner's own sources. An `upload` link takes over a `research` one, never the reverse, and a
 * link keeps the upload request it answered. Returns how many links it added or changed.
 */
export async function linkGoalSources(
  tx: TransactionClient,
  {
    goalId,
    origin,
    sourceIds,
    userId,
  }: { goalId: string; origin: LearnerSourceOrigin; sourceIds: readonly string[]; userId: string },
): Promise<number> {
  if (sourceIds.length === 0) {
    return 0;
  }

  return tx.$executeRaw`
    INSERT INTO goal_sources (goal_id, source_id, origin)
    SELECT goals.id, learner_sources.source_id, ${origin}::"LearnerSourceOrigin"
    FROM learner_sources
    JOIN goals ON goals.id = ${goalId}::uuid AND goals.user_id = learner_sources.user_id
    WHERE learner_sources.user_id = ${userId}::uuid
      AND learner_sources.source_id = ANY(${[...sourceIds]}::uuid[])
    ON CONFLICT (goal_id, source_id) DO UPDATE SET origin = EXCLUDED.origin
    WHERE EXCLUDED.origin = 'upload' AND goal_sources.origin <> 'upload'
  `;
}
