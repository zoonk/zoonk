import { type GuestLinkContext } from "./merge-keyed-rows";

/**
 * The guest's reminder moves over when the account has none; otherwise the account's choices stay,
 * so it isn't offered again and a day already sent isn't sent twice.
 */
export async function mergeStudyReminder({
  guestUserId,
  sessionId,
  transaction,
  userId,
}: GuestLinkContext & { sessionId?: string }) {
  await transaction.studyReminder.updateMany({
    data: { pushSessionId: sessionId ?? null },
    where: {
      pushSession: { expiresAt: { gt: new Date() }, userId: guestUserId },
      userId: { in: [guestUserId, userId] },
    },
  });

  await transaction.$executeRaw`
    WITH guest_reminder AS (
      DELETE FROM study_reminders
      WHERE user_id = ${guestUserId}::uuid
      RETURNING *
    )
    INSERT INTO study_reminders (
      id, user_id, time, locale, email_on, push_on, push_token, push_platform, push_label, push_session_id,
      offered_at, enabled_at, processed_on, created_at, updated_at
    )
    SELECT id, ${userId}::uuid, time, locale, email_on, push_on, push_token, push_platform, push_label,
      push_session_id,
      offered_at, enabled_at, processed_on, created_at, updated_at
    FROM guest_reminder
    ON CONFLICT (user_id) DO UPDATE SET
      offered_at = LEAST(study_reminders.offered_at, EXCLUDED.offered_at),
      processed_on = GREATEST(study_reminders.processed_on, EXCLUDED.processed_on),
      updated_at = clock_timestamp()
  `;
}
