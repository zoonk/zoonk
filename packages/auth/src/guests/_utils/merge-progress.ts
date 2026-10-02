import { type DailyProgress, type UserLearningProfile } from "@zoonk/db";
import { type GuestLinkContext } from "./merge-keyed-rows";

type ProfileMerge = Pick<
  UserLearningProfile,
  "activeGoalId" | "birthMonth" | "birthYear" | "buddyGlasses" | "buddyKind" | "buddyName"
>;

/** Adds a guest's day to the account's day, keeping the higher Energy the day ended with. */
function getMergedDay({
  account,
  guest,
}: {
  account: Pick<DailyProgress, "energyAtEnd">;
  guest: DailyProgress;
}) {
  return {
    brainPowerEarned: { increment: guest.brainPowerEarned },
    correctAnswers: { increment: guest.correctAnswers },
    energyAtEnd: Math.max(account.energyAtEnd, guest.energyAtEnd),
    incorrectAnswers: { increment: guest.incorrectAnswers },
    interactiveCompleted: { increment: guest.interactiveCompleted },
    lessonsCompleted: { increment: guest.lessonsCompleted },
    staticCompleted: { increment: guest.staticCompleted },
    timeSpentSeconds: { increment: guest.timeSpentSeconds },
  };
}

/** Days both learners studied are added together; the guest's other days move as they are. */
export async function mergeDailyProgress({ guestUserId, transaction, userId }: GuestLinkContext) {
  const guestDays = await transaction.dailyProgress.findMany({ where: { userId: guestUserId } });

  const accountDays = await transaction.dailyProgress.findMany({
    select: { date: true, energyAtEnd: true, id: true },
    where: { date: { in: guestDays.map((day) => day.date) }, userId },
  });

  const accountDaysByDate = new Map(accountDays.map((day) => [day.date.getTime(), day]));

  const sharedDays = guestDays.flatMap((guest) => {
    const account = accountDaysByDate.get(guest.date.getTime());
    return account ? [{ account, guest }] : [];
  });

  await Promise.all(
    sharedDays.map(({ account, guest }) =>
      transaction.dailyProgress.update({
        data: getMergedDay({ account, guest }),
        where: { id: account.id },
      }),
    ),
  );

  await transaction.dailyProgress.deleteMany({
    where: { id: { in: sharedDays.map(({ guest }) => guest.id) } },
  });

  await transaction.dailyProgress.updateMany({ data: { userId }, where: { userId: guestUserId } });
}

/** Brain Power adds up, while Energy and last activity keep the higher value. */
export async function mergeUserProgress({ guestUserId, transaction, userId }: GuestLinkContext) {
  const [guest, account] = await Promise.all([
    transaction.userProgress.findUnique({ where: { userId: guestUserId } }),
    transaction.userProgress.findUnique({ where: { userId } }),
  ]);

  if (!guest) {
    return;
  }

  if (!account) {
    await transaction.userProgress.update({ data: { userId }, where: { id: guest.id } });
    return;
  }

  await transaction.userProgress.update({
    data: {
      currentEnergy: Math.max(account.currentEnergy, guest.currentEnergy),
      lastActiveAt:
        account.lastActiveAt > guest.lastActiveAt ? account.lastActiveAt : guest.lastActiveAt,
      totalBrainPower: { increment: guest.totalBrainPower },
    },
    where: { id: account.id },
  });
}

/**
 * An account's own settings win, and the guest fills what it lacks. The guest's active goal wins,
 * because signing in from a guest session means "save the plan I just made".
 */
function getMergedProfile({
  account,
  guest,
}: {
  account: UserLearningProfile;
  guest: UserLearningProfile;
}): ProfileMerge {
  const buddy = account.buddyKind ? account : guest;
  const birth = account.birthMonth !== null && account.birthYear !== null ? account : guest;

  return {
    activeGoalId: guest.activeGoalId ?? account.activeGoalId,
    birthMonth: birth.birthMonth,
    birthYear: birth.birthYear,
    buddyGlasses: buddy.buddyGlasses,
    buddyKind: buddy.buddyKind,
    buddyName: buddy.buddyName,
  };
}

/**
 * A new account takes the guest's whole profile; an existing one merges it field by field. The
 * active goal is unique per profile, so the guest's profile is removed before the account takes
 * the guest's goal.
 */
export async function mergeLearningProfile({ guestUserId, transaction, userId }: GuestLinkContext) {
  const [guest, account] = await Promise.all([
    transaction.userLearningProfile.findUnique({ where: { userId: guestUserId } }),
    transaction.userLearningProfile.findUnique({ where: { userId } }),
  ]);

  if (!guest) {
    return;
  }

  if (!account) {
    await transaction.userLearningProfile.update({ data: { userId }, where: { id: guest.id } });
    return;
  }

  await transaction.userLearningProfile.delete({ where: { id: guest.id } });

  await transaction.userLearningProfile.update({
    data: getMergedProfile({ account, guest }),
    where: { id: account.id },
  });
}
