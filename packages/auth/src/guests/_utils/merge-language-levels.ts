import { type GuestLinkContext } from "./merge-keyed-rows";

/**
 * A level can fall as well as rise, so the latest assessment wins whole, never the highest score.
 * Adding windows from different baselines could invent a level change.
 */
export async function mergeLanguageLevels({ guestUserId, transaction, userId }: GuestLinkContext) {
  await transaction.$executeRaw`
    WITH guest_levels AS (
      DELETE FROM language_skill_levels
      WHERE user_id = ${guestUserId}::uuid
      RETURNING *
    )
    INSERT INTO language_skill_levels (
      id, user_id, language, skill, score, start_score,
      window_correct, window_total, window_ceiling, created_at, updated_at
    )
    SELECT id, ${userId}::uuid, language, skill, score, start_score,
      window_correct, window_total, window_ceiling, created_at, updated_at
    FROM guest_levels
    ORDER BY language, skill
    ON CONFLICT (user_id, language, skill) DO UPDATE SET
      score = EXCLUDED.score,
      start_score = EXCLUDED.start_score,
      window_correct = EXCLUDED.window_correct,
      window_total = EXCLUDED.window_total,
      window_ceiling = EXCLUDED.window_ceiling,
      updated_at = EXCLUDED.updated_at
    WHERE EXCLUDED.updated_at > language_skill_levels.updated_at
      OR (EXCLUDED.updated_at = language_skill_levels.updated_at
        AND EXCLUDED.window_total > language_skill_levels.window_total)
  `;
}
