import { type UserLearningProfile, prisma } from "@zoonk/db";
import { getAgeGroup } from "@zoonk/utils/age";
import { APIError } from "better-auth/api";
import { ACCESS_ERROR_CODES } from "../access-contract";
import { deleteUserDependenciesBeforeAuthDelete } from "../account-deletion";
import { type GuestLinkContext, moveKeyedRows } from "./_utils/merge-keyed-rows";
import {
  mergeDailyProgress,
  mergeLearningProfile,
  mergeUserProgress,
} from "./_utils/merge-progress";

/** An account this young was just created by the sign-up that is linking the guest. */
const NEW_ACCOUNT_WINDOW_MS = 3_600_000;

type LinkedAccount = { createdAt: Date; email: string; id: string };

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
 * usage and private content. It runs in one transaction, so a failure leaves the guest untouched
 * and the sign-in can be retried.
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

export function underMinimumAgeError() {
  return new APIError("FORBIDDEN", {
    code: ACCESS_ERROR_CODES.underMinimumAge,
    message: "You need to be 13 or older to create an account.",
  });
}

/** A guest who said they're under 13 can't have an account. */
export function isChildProfile(
  profile: Pick<UserLearningProfile, "birthMonth" | "birthYear"> | null,
) {
  return (
    getAgeGroup({
      birthMonth: profile?.birthMonth ?? null,
      birthYear: profile?.birthYear ?? null,
    }) === "child"
  );
}

async function isChildGuest(guestUserId: string) {
  return isChildProfile(
    await prisma.userLearningProfile.findUnique({ where: { userId: guestUserId } }),
  );
}

/** Only an account that was created just now and never gave its own age takes a guest's age. */
async function isAccountCreatedByThisGuest(account: LinkedAccount) {
  if (Date.now() - account.createdAt.getTime() > NEW_ACCOUNT_WINDOW_MS) {
    return false;
  }

  const profile = await prisma.userLearningProfile.findUnique({ where: { userId: account.id } });

  return !profile || profile.birthMonth === null || profile.birthYear === null;
}

/**
 * Links a guest to the account that just signed in. A guest who said they're under 13 can't create
 * an account: when the account was created by that sign-up, it is deleted. An older account that
 * signs in on the same device keeps its own data, and the child's guest answers are dropped.
 */
export async function linkGuestAccount({
  account,
  guestUserId,
}: {
  account: LinkedAccount;
  guestUserId: string;
}) {
  if (!(await isChildGuest(guestUserId))) {
    await moveGuestData({ guestUserId, userId: account.id });
    return;
  }

  if (!(await isAccountCreatedByThisGuest(account))) {
    return;
  }

  await deleteUserDependenciesBeforeAuthDelete(account);
  await prisma.user.delete({ where: { id: account.id } });

  throw underMinimumAgeError();
}
