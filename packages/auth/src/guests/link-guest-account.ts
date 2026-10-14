import { isPrismaTransactionConflictError, isPrismaUniqueConstraintError, prisma } from "@zoonk/db";
import { lockCourseHome } from "@zoonk/db/course-home";
import { markLearnerRevision, markPlanInputsChanged } from "@zoonk/db/learner-revision";
import { safeAsync } from "@zoonk/utils/error";
import { type GuestLinkContext, moveKeyedRows } from "./_utils/merge-keyed-rows";
import { mergeLanguageLevels } from "./_utils/merge-language-levels";
import {
  mergeDailyProgress,
  mergeLearningProfile,
  mergeUserProgress,
} from "./_utils/merge-progress";
import { movePrivateCourses } from "./_utils/move-private-courses";
import { moveTutorThreads } from "./_utils/move-tutor-threads";

/** Retry rolled-back transaction conflicts from competing writers without repeating external effects. */
const TRANSFER_ATTEMPTS = 3;

/** Another link moved the guest first: roll back this one's marks, since it changed nothing. */
class GuestAlreadyLinkedError extends Error {
  constructor() {
    super("The guest was already linked");
    this.name = "GuestAlreadyLinkedError";
  }
}

/**
 * Worth a retry from the start: a competing writer's conflict, or a tutor thread the account
 * started about the same thing mid-move (a unique key), which the retry joins instead.
 */
function isRetryableTransferError(error: unknown) {
  return isPrismaTransactionConflictError(error) || isPrismaUniqueConstraintError(error);
}

/** Rows with no per-learner unique key move as they are, including private content below its course. */
async function moveOwnedRows({ guestUserId, transaction, userId }: GuestLinkContext) {
  const fromGuest = { userId: guestUserId };
  const toAccount = { userId };
  const ownedByGuest = { ownerId: guestUserId };
  const ownedByAccount = { ownerId: userId };

  await Promise.all([
    transaction.goal.updateMany({ data: toAccount, where: fromGuest }),
    transaction.onboardingDraft.updateMany({ data: toAccount, where: fromGuest }),
    transaction.studySession.updateMany({ data: toAccount, where: fromGuest }),
    transaction.attempt.updateMany({ data: toAccount, where: fromGuest }),
    transaction.mistake.updateMany({ data: toAccount, where: fromGuest }),
    transaction.memoryFact.updateMany({ data: toAccount, where: fromGuest }),
    transaction.learningEvent.updateMany({ data: toAccount, where: fromGuest }),
    transaction.feedback.updateMany({ data: toAccount, where: fromGuest }),
    transaction.aiCall.updateMany({ data: toAccount, where: fromGuest }),
    transaction.languageConversation.updateMany({ data: toAccount, where: fromGuest }),
    transaction.mistakePattern.updateMany({ data: toAccount, where: fromGuest }),
    transaction.mockExam.updateMany({ data: toAccount, where: fromGuest }),
    transaction.examResult.updateMany({ data: toAccount, where: fromGuest }),
    transaction.skill.updateMany({ data: ownedByAccount, where: ownedByGuest }),
    transaction.chapter.updateMany({ data: ownedByAccount, where: ownedByGuest }),
    transaction.lesson.updateMany({ data: ownedByAccount, where: ownedByGuest }),
    transaction.mediaAsset.updateMany({ data: ownedByAccount, where: ownedByGuest }),
    transaction.source.updateMany({ data: ownedByAccount, where: ownedByGuest }),
    transaction.examBlueprint.updateMany({ data: ownedByAccount, where: ownedByGuest }),
  ]);
}

/**
 * Moves everything a guest did to the account they signed up or signed in with: goals and plans,
 * goals typed and how they were understood, sessions, attempts, mistakes and their patterns,
 * skills, memory and its insights, conversations with the tutor and in the language, mocks and
 * exam results, feedback, stats, language evidence, words and pronunciation reviews, example
 * lines, usage, AI calls (so the account's spend counts them) and private content. It runs in one
 * transaction, so a failure leaves the guest untouched and the sign-in can be retried.
 */
async function moveGuestData({
  attempt = 1,
  guestUserId,
  userId,
}: {
  attempt?: number;
  guestUserId: string;
  userId: string;
}): Promise<void> {
  const result = await safeAsync(() =>
    prisma.$transaction(async (transaction) => {
      const context = { guestUserId, transaction, userId };

      /**
       * The account's summary changes, and so do the inputs of every plan the move feeds: the
       * account's and the guest's, which read the merged skills and evidence. Mark them before any
       * domain lock, plans then the account, in the order every learner writer locks them.
       */
      await markPlanInputsChanged(transaction, { userIds: [userId, guestUserId] });
      await markLearnerRevision(transaction, { userId });

      /** Serialize account merges, acquiring the home lock before any user FK lock like writers do. */
      await lockCourseHome({ homeId: userId, transaction });

      /**
       * Every insert naming this guest needs a user-row key-share lock. Lock it before moving any
       * table, so existing writers finish first and later writers wait until removal, then fail
       * their foreign key safely. Course-home locks alone cannot protect chapters, skills or sources.
       */
      const guests = await transaction.$queryRaw<{ id: string }[]>`
      SELECT id FROM users
      WHERE id = ${guestUserId}::uuid AND is_anonymous
      FOR UPDATE
    `;

      if (guests.length === 0) {
        throw new GuestAlreadyLinkedError();
      }

      await moveTutorThreads(context);
      await movePrivateCourses(context);
      await moveOwnedRows(context);
      await moveKeyedRows(context);
      await mergeLanguageLevels(context);

      /** Match settlements on the destination too: lifetime progress before the colliding day. */
      await mergeUserProgress(context);
      await mergeDailyProgress(context);
      await mergeLearningProfile(context);

      /**
       * Keep the guest row locked through removal, even when it had no courses. A workflow with
       * the old owner either committed before the snapshot or now fails its user foreign key;
       * no course can be created between the transfer and Better Auth's post-link cleanup.
       */
      await transaction.user.delete({ where: { id: guestUserId } });
    }),
  );

  if (!result.error || result.error instanceof GuestAlreadyLinkedError) {
    return;
  }

  if (attempt < TRANSFER_ATTEMPTS && isRetryableTransferError(result.error)) {
    return moveGuestData({ attempt: attempt + 1, guestUserId, userId });
  }

  throw result.error;
}

/** Links a guest to the account that just signed in, moving everything the guest did to it. */
export async function linkGuestAccount({
  account,
  guestUserId,
}: {
  account: { id: string };
  guestUserId: string;
}) {
  if (guestUserId === account.id) {
    return;
  }

  await moveGuestData({ guestUserId, userId: account.id });
}
