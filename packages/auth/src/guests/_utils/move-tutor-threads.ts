import { type GuestLinkContext } from "./merge-keyed-rows";

type ThreadPair = { accountThreadId: string; guestThreadId: string };

/**
 * Locks threads in id order. A turn locks its one thread before writing, so one being asked or
 * answered finishes first, and a later one waits for the move.
 */
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

/** The account's threads about what a guest thread is about: one subject column each. */
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
 * Joins each guest thread's questions to the account's thread about the same thing, in time order
 * with their ids kept. Request ids only dedupe one client's retries of a turn, so a guest question
 * reusing one the account's thread holds gets a new id, and the account's keeps answering it.
 */
async function joinSameSubjectThreads({
  pairs,
  transaction,
}: Pick<GuestLinkContext, "transaction"> & { pairs: ThreadPair[] }) {
  const guestThreadIds = pairs.map((pair) => pair.guestThreadId);
  const accountThreadIds = pairs.map((pair) => pair.accountThreadId);

  await lockThreads({ threadIds: accountThreadIds, transaction });

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

/**
 * Moves a guest's tutor threads, questions included, to the account. A thread about something the
 * account already asks about (the same lesson, chapter or question) joins the account's instead,
 * since a learner has one thread per thing. The guest's row is locked by then, so no new guest
 * thread appears; a turn on an existing one waits for its thread's lock.
 */
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

  /**
   * A thread the account starts about the same thing after the lookup fails this update on its
   * unique key; the link retries from the start and joins the two.
   */
  await transaction.lessonQuestionThread.updateMany({
    data: { userId },
    where: { userId: guestUserId },
  });
}
