import { isPrismaTransactionConflictError, isPrismaUniqueConstraintError, prisma } from "@zoonk/db";
import { lockCourseHome } from "@zoonk/db/course-home";
import { lockLearner, markPlanInputsChanged } from "@zoonk/db/learner-writes";
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

const TRANSFER_ATTEMPTS = 3;

/** `plansChanged`: another link moved a goal into the account while this one waited, so it starts over to mark that plan. */
class LinkRollbackError extends Error {
  readonly reason: "alreadyLinked" | "plansChanged";

  constructor(reason: LinkRollbackError["reason"]) {
    super(`Guest link rolled back: ${reason}`);
    this.name = "LinkRollbackError";
    this.reason = reason;
  }
}

function isLinkRollbackError(error: unknown, reason: LinkRollbackError["reason"]) {
  return error instanceof LinkRollbackError && error.reason === reason;
}

/** A unique-key clash is a tutor thread the account started mid-move, which the retry joins. */
function isRetryableTransferError(error: unknown) {
  return (
    isLinkRollbackError(error, "plansChanged") ||
    isPrismaTransactionConflictError(error) ||
    isPrismaUniqueConstraintError(error)
  );
}

/** Locks the plans, then the account, before any domain lock, in the order every learner writer locks them. */
async function markAccountChanged({ guestUserId, transaction, userId }: GuestLinkContext) {
  const userIds = [userId, guestUserId];

  const markedPlanIds = new Set(await markPlanInputsChanged(transaction, { userIds }));

  await lockLearner(transaction, { userId });

  const plans = await transaction.plan.findMany({
    select: { id: true },
    where: { goal: { userId: { in: userIds } } },
  });

  if (plans.some((plan) => !markedPlanIds.has(plan.id))) {
    throw new LinkRollbackError("plansChanged");
  }
}

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
    transaction.evaluationRun.updateMany({ data: toAccount, where: fromGuest }),
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

      await markAccountChanged(context);

      // The home lock comes before any user foreign-key lock, as in every writer.
      await lockCourseHome({ homeId: userId, transaction });

      // Locking the guest row before moving any table lets existing writers finish first; later
      // ones wait until removal and then fail their foreign key.
      const guests = await transaction.$queryRaw<{ id: string }[]>`
      SELECT id FROM users
      WHERE id = ${guestUserId}::uuid AND is_anonymous
      FOR UPDATE
    `;

      if (guests.length === 0) {
        throw new LinkRollbackError("alreadyLinked");
      }

      await moveTutorThreads(context);
      await movePrivateCourses(context);
      await moveOwnedRows(context);
      await moveKeyedRows(context);
      await mergeLanguageLevels(context);

      // Lifetime progress before the day, in the order settlements lock them.
      await mergeUserProgress(context);
      await mergeDailyProgress(context);
      await mergeLearningProfile(context);

      // Removed here, not in Better Auth's post-link cleanup, so no course is created for the guest in between.
      await transaction.user.delete({ where: { id: guestUserId } });
    }),
  );

  if (!result.error || isLinkRollbackError(result.error, "alreadyLinked")) {
    return;
  }

  if (attempt < TRANSFER_ATTEMPTS && isRetryableTransferError(result.error)) {
    return moveGuestData({ attempt: attempt + 1, guestUserId, userId });
  }

  throw result.error;
}

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
