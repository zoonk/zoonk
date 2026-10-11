import { prisma } from "@zoonk/db";
import { type GuestLinkContext, moveKeyedRows } from "./_utils/merge-keyed-rows";
import {
  mergeDailyProgress,
  mergeLearningProfile,
  mergeUserProgress,
} from "./_utils/merge-progress";

/** Rows with no per-learner unique key move as they are, including the private content a guest's plan uses. */
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
    transaction.course.updateMany({ data: toAccount, where: fromGuest }),
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
 * goals typed but not confirmed yet, sessions, attempts, mistakes, skills, memory, feedback, stats,
 * usage, AI calls (so the account's spend counts them) and private content. It runs in one
 * transaction, so a failure leaves the guest untouched and the sign-in can be retried.
 */
async function moveGuestData({ guestUserId, userId }: { guestUserId: string; userId: string }) {
  await prisma.$transaction(async (transaction) => {
    const context = { guestUserId, transaction, userId };

    await moveOwnedRows(context);
    await moveKeyedRows(context);
    await mergeDailyProgress(context);
    await mergeUserProgress(context);
    await mergeLearningProfile(context);
  });
}

/** Links a guest to the account that just signed in, moving everything the guest did to it. */
export async function linkGuestAccount({
  account,
  guestUserId,
}: {
  account: { id: string };
  guestUserId: string;
}) {
  await moveGuestData({ guestUserId, userId: account.id });
}
