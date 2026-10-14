import { type TransactionClient } from "@zoonk/db";

export type GuestLinkContext = {
  guestUserId: string;
  transaction: TransactionClient;
  userId: string;
};

/** Delete and reinsert within one statement so concurrent account writes resolve at the unique constraint. */
async function moveLearnerSkills({ guestUserId, transaction, userId }: GuestLinkContext) {
  await transaction.$executeRaw`
    WITH guest_rows AS (
      DELETE FROM learner_skills
      WHERE user_id = ${guestUserId}::uuid
      RETURNING *
    )
    INSERT INTO learner_skills (id, user_id, skill_id, state, stability, difficulty, due, last_reviewed_at, reps, lapses, recall_days, created_at, updated_at)
    SELECT id, ${userId}::uuid, skill_id, state, stability, difficulty, due, last_reviewed_at, reps, lapses, recall_days, created_at, updated_at
    FROM guest_rows
    ORDER BY skill_id
    ON CONFLICT (user_id, skill_id) DO NOTHING
  `;
}

async function moveMilestones({ guestUserId, transaction, userId }: GuestLinkContext) {
  await transaction.$executeRaw`
    WITH guest_rows AS (
      DELETE FROM milestones
      WHERE user_id = ${guestUserId}::uuid
      RETURNING *
    )
    INSERT INTO milestones (id, user_id, kind, key, earned_at, shown_at)
    SELECT id, ${userId}::uuid, kind, key, earned_at, shown_at
    FROM guest_rows
    ORDER BY kind, key
    ON CONFLICT (user_id, kind, key) DO NOTHING
  `;
}

async function moveContentFeedback({ guestUserId, transaction, userId }: GuestLinkContext) {
  await transaction.$executeRaw`
    WITH guest_rows AS (
      DELETE FROM content_feedback
      WHERE user_id = ${guestUserId}::uuid
      RETURNING *
    )
    INSERT INTO content_feedback (id, user_id, content_kind, content_id, vote, reasons, comment, language, model, prompt_version, run_id, created_at, updated_at)
    SELECT id, ${userId}::uuid, content_kind, content_id, vote, reasons, comment, language, model, prompt_version, run_id, created_at, updated_at
    FROM guest_rows
    ORDER BY content_kind, content_id
    ON CONFLICT (user_id, content_kind, content_id) DO NOTHING
  `;
}

async function moveUsageRecords({ guestUserId, transaction, userId }: GuestLinkContext) {
  await transaction.$executeRaw`
    WITH guest_rows AS (
      DELETE FROM usage_records
      WHERE user_id = ${guestUserId}::uuid
      RETURNING *
    )
    INSERT INTO usage_records (id, user_id, kind, target_id, generated, cost_micros, seconds, created_at)
    SELECT id, ${userId}::uuid, kind, target_id, generated, cost_micros, seconds, created_at
    FROM guest_rows
    ORDER BY kind, target_id
    ON CONFLICT (user_id, kind, target_id) DO NOTHING
  `;
}

async function moveLearnerSources({ guestUserId, transaction, userId }: GuestLinkContext) {
  await transaction.$executeRaw`
    WITH guest_rows AS (
      DELETE FROM learner_sources
      WHERE user_id = ${guestUserId}::uuid
      RETURNING *
    )
    INSERT INTO learner_sources (id, user_id, source_id, goal_id, origin, created_at)
    SELECT id, ${userId}::uuid, source_id, goal_id, origin, created_at
    FROM guest_rows
    ORDER BY source_id
    ON CONFLICT (user_id, source_id) DO NOTHING
  `;
}

async function moveLearnerWords({ guestUserId, transaction, userId }: GuestLinkContext) {
  /** Resolve duplicates atomically, including words learned or linked concurrently on the account. */
  await transaction.$executeRaw`
    WITH guest_words AS (
      DELETE FROM learner_words
      WHERE user_id = ${guestUserId}::uuid
      RETURNING *
    )
    INSERT INTO learner_words (id, user_id, language, word_id, text, learned_at)
    SELECT id, ${userId}::uuid, language, word_id, text, learned_at
    FROM guest_words
    ORDER BY word_id
    ON CONFLICT (user_id, word_id) DO NOTHING
  `;
}

/** Moves guest rows with per-learner unique keys, keeping the account's on a clash; language levels merge separately. */
export async function moveKeyedRows(context: GuestLinkContext) {
  await moveLearnerSkills(context);
  await moveMilestones(context);
  await moveContentFeedback(context);
  await moveUsageRecords(context);
  await moveLearnerSources(context);
  await moveLearnerWords(context);
}
