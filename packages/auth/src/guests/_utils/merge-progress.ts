import { type GuestLinkContext } from "./merge-keyed-rows";

export async function mergeDailyProgress({ guestUserId, transaction, userId }: GuestLinkContext) {
  await transaction.$executeRaw`
    WITH guest_days AS (
      DELETE FROM daily_progress
      WHERE user_id = ${guestUserId}::uuid
      RETURNING *
    )
    INSERT INTO daily_progress (
      id, user_id, date, day_of_week, correct_answers, incorrect_answers,
      static_completed, interactive_completed, lessons_completed, brain_power_earned,
      time_spent_seconds, energy_at_end
    )
    SELECT id, ${userId}::uuid, date, day_of_week, correct_answers, incorrect_answers,
      static_completed, interactive_completed, lessons_completed, brain_power_earned,
      time_spent_seconds, energy_at_end
    FROM guest_days
    ORDER BY date
    ON CONFLICT (user_id, date) DO UPDATE SET
      correct_answers = daily_progress.correct_answers + EXCLUDED.correct_answers,
      incorrect_answers = daily_progress.incorrect_answers + EXCLUDED.incorrect_answers,
      static_completed = daily_progress.static_completed + EXCLUDED.static_completed,
      interactive_completed = daily_progress.interactive_completed + EXCLUDED.interactive_completed,
      lessons_completed = daily_progress.lessons_completed + EXCLUDED.lessons_completed,
      brain_power_earned = daily_progress.brain_power_earned + EXCLUDED.brain_power_earned,
      time_spent_seconds = daily_progress.time_spent_seconds + EXCLUDED.time_spent_seconds,
      energy_at_end = GREATEST(daily_progress.energy_at_end, EXCLUDED.energy_at_end)
  `;
}

export async function mergeUserProgress({ guestUserId, transaction, userId }: GuestLinkContext) {
  await transaction.$executeRaw`
    WITH guest_progress AS (
      DELETE FROM user_progress
      WHERE user_id = ${guestUserId}::uuid
      RETURNING *
    )
    INSERT INTO user_progress (id, user_id, current_energy, total_brain_power, last_active_at)
    SELECT id, ${userId}::uuid, current_energy, total_brain_power, last_active_at
    FROM guest_progress
    ON CONFLICT (user_id) DO UPDATE SET
      current_energy = GREATEST(user_progress.current_energy, EXCLUDED.current_energy),
      total_brain_power = user_progress.total_brain_power + EXCLUDED.total_brain_power,
      last_active_at = GREATEST(user_progress.last_active_at, EXCLUDED.last_active_at)
  `;
}

/** Removing the guest profile first frees its unique active goal before the account takes it. */
export async function mergeLearningProfile({ guestUserId, transaction, userId }: GuestLinkContext) {
  await transaction.$executeRaw`
    WITH guest_profile AS (
      DELETE FROM user_learning_profiles
      WHERE user_id = ${guestUserId}::uuid
      RETURNING *
    )
    INSERT INTO user_learning_profiles (
      id, user_id, interests, preferences, instructions, buddy_kind, buddy_name, buddy_glasses,
      active_goal_id, memory_enabled, sounds_enabled, daily_limit_minutes, created_at, updated_at
    )
    SELECT id, ${userId}::uuid, interests, preferences, instructions, buddy_kind, buddy_name, buddy_glasses,
      active_goal_id, memory_enabled, sounds_enabled, daily_limit_minutes, created_at, updated_at
    FROM guest_profile
    ON CONFLICT (user_id) DO UPDATE SET
      active_goal_id = COALESCE(EXCLUDED.active_goal_id, user_learning_profiles.active_goal_id),
      buddy_kind = COALESCE(user_learning_profiles.buddy_kind, EXCLUDED.buddy_kind),
      buddy_name = CASE WHEN user_learning_profiles.buddy_kind IS NOT NULL
        THEN user_learning_profiles.buddy_name ELSE EXCLUDED.buddy_name END,
      buddy_glasses = CASE WHEN user_learning_profiles.buddy_kind IS NOT NULL
        THEN user_learning_profiles.buddy_glasses ELSE EXCLUDED.buddy_glasses END,
      updated_at = clock_timestamp()
  `;
}
