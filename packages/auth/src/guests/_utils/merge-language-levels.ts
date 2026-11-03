import { type GuestLinkContext } from "./merge-keyed-rows";

/**
 * A level can fall as well as rise, so the latest assessment wins whole, never the highest score.
 * Adding windows from different baselines could invent a level change. A skill the learner's answers
 * raised beats one that wasn't, since certificates count raised skills and must never lose one.
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
      window_correct, window_total, window_ceiling, raised_at, created_at, updated_at
    )
    SELECT id, ${userId}::uuid, language, skill, score, start_score,
      window_correct, window_total, window_ceiling, raised_at, created_at, updated_at
    FROM guest_levels
    ORDER BY language, skill
    ON CONFLICT (user_id, language, skill) DO UPDATE SET
      score = EXCLUDED.score,
      start_score = EXCLUDED.start_score,
      window_correct = EXCLUDED.window_correct,
      window_total = EXCLUDED.window_total,
      window_ceiling = EXCLUDED.window_ceiling,
      raised_at = EXCLUDED.raised_at,
      updated_at = EXCLUDED.updated_at
    WHERE (EXCLUDED.raised_at IS NOT NULL AND language_skill_levels.raised_at IS NULL)
      OR ((EXCLUDED.raised_at IS NULL) = (language_skill_levels.raised_at IS NULL)
        AND (EXCLUDED.updated_at > language_skill_levels.updated_at
          OR (EXCLUDED.updated_at = language_skill_levels.updated_at
            AND EXCLUDED.window_total > language_skill_levels.window_total)))
  `;
}
