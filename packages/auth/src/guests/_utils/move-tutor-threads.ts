import { type GuestLinkContext } from "./merge-keyed-rows";

type ThreadPair = { accountThreadId: string; guestThreadId: string };

async function lockThreads({
  threadIds,
  transaction,
}: Pick<GuestLinkContext, "transaction"> & { threadIds: string[] }) {
  await transaction.$queryRaw`
    SELECT id FROM lesson_question_threads
    WHERE id = ANY(${threadIds}::uuid[])
    ORDER BY id
    FOR UPDATE
  `;
}

function findSameSubjectThreads({ guestUserId, transaction, userId }: GuestLinkContext) {
  return transaction.$queryRaw<ThreadPair[]>`
    SELECT guest.id AS "guestThreadId", account.id AS "accountThreadId"
    FROM lesson_question_threads AS guest
    JOIN lesson_question_threads AS account
      ON account.user_id = ${userId}::uuid
      AND (
        account.library_lesson_id = guest.library_lesson_id
        OR account.chapter_id = guest.chapter_id
        OR account.goal_id = guest.goal_id
        OR account.mock_exam_id = guest.mock_exam_id
        OR (account.subject_goal_id = guest.subject_goal_id AND account.subject_key = guest.subject_key)
        OR account.item_id = guest.item_id
      )
    WHERE guest.user_id = ${guestUserId}::uuid
  `;
}

/**
 * A conversation answers one screen's unfinished turns one at a time, so a joined thread keeps one
 * open per screen. The others close unanswered and can be asked again.
 */
async function closeExtraUnfinishedTurns({
  accountThreadIds,
  guestThreadIds,
  transaction,
}: Pick<GuestLinkContext, "transaction"> & {
  accountThreadIds: string[];
  guestThreadIds: string[];
}) {
  await transaction.$executeRaw`
    WITH pair AS (
      SELECT * FROM unnest(${guestThreadIds}::uuid[], ${accountThreadIds}::uuid[]) AS pair(guest_thread_id, account_thread_id)
    ),
    unfinished AS (
      SELECT question.id, question.status, question.created_at, question.library_step_id,
        pair.account_thread_id, question.thread_id = pair.account_thread_id AS on_account
      FROM lesson_questions AS question
      JOIN pair ON question.thread_id IN (pair.guest_thread_id, pair.account_thread_id)
      WHERE question.status <> 'completed'
    ),
    kept AS (
      SELECT DISTINCT ON (account_thread_id, library_step_id) id FROM unfinished
      ORDER BY account_thread_id, library_step_id,
        (on_account AND status = 'running') DESC, created_at DESC, id DESC
    )
    UPDATE lesson_questions SET status = 'completed'
    WHERE id IN (SELECT id FROM unfinished) AND id NOT IN (SELECT id FROM kept)
  `;
}

/**
 * Request ids only dedupe one client's retries, so a guest question reusing an id the account's
 * thread holds gets a new one.
 */
async function joinSameSubjectThreads({
  pairs,
  transaction,
}: Pick<GuestLinkContext, "transaction"> & { pairs: ThreadPair[] }) {
  const guestThreadIds = pairs.map((pair) => pair.guestThreadId);
  const accountThreadIds = pairs.map((pair) => pair.accountThreadId);

  await lockThreads({ threadIds: accountThreadIds, transaction });
  await closeExtraUnfinishedTurns({ accountThreadIds, guestThreadIds, transaction });

  await transaction.$executeRaw`
    UPDATE lesson_questions AS question SET request_id = uuidv7()
    FROM unnest(${guestThreadIds}::uuid[], ${accountThreadIds}::uuid[]) AS pair(guest_thread_id, account_thread_id)
    WHERE question.thread_id = pair.guest_thread_id
      AND EXISTS (
        SELECT 1 FROM lesson_questions AS kept
        WHERE kept.thread_id = pair.account_thread_id AND kept.request_id = question.request_id
      )
  `;

  await transaction.$executeRaw`
    UPDATE lesson_questions AS question SET thread_id = pair.account_thread_id
    FROM unnest(${guestThreadIds}::uuid[], ${accountThreadIds}::uuid[]) AS pair(guest_thread_id, account_thread_id)
    WHERE question.thread_id = pair.guest_thread_id
  `;

  await transaction.$executeRaw`
    UPDATE lesson_question_threads AS account
    SET created_at = LEAST(account.created_at, guest.created_at),
      updated_at = GREATEST(account.updated_at, guest.updated_at)
    FROM unnest(${guestThreadIds}::uuid[], ${accountThreadIds}::uuid[]) AS pair(guest_thread_id, account_thread_id)
    JOIN lesson_question_threads AS guest ON guest.id = pair.guest_thread_id
    WHERE account.id = pair.account_thread_id
  `;

  await transaction.lessonQuestionThread.deleteMany({ where: { id: { in: guestThreadIds } } });
}

/** Requires the guest's row lock, so no new guest thread appears meanwhile. */
export async function moveTutorThreads(context: GuestLinkContext) {
  const { guestUserId, transaction, userId } = context;

  const guestThreads = await transaction.lessonQuestionThread.findMany({
    select: { id: true },
    where: { userId: guestUserId },
  });

  await lockThreads({ threadIds: guestThreads.map((thread) => thread.id), transaction });

  const pairs = await findSameSubjectThreads(context);

  if (pairs.length > 0) {
    await joinSameSubjectThreads({ pairs, transaction });
  }

  // A thread the account starts after the lookup fails this on its unique key; the link retries and joins them.
  await transaction.lessonQuestionThread.updateMany({
    data: { userId },
    where: { userId: guestUserId },
  });
}
