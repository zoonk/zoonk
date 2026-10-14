import { prisma } from "@zoonk/db";
import { reportSignUp } from "./sign-up-events";
import { type UserCreateAfterHook } from "./user-create-hooks";

/**
 * Better Auth owns account creation, but learner stats live in our app schema.
 * Creating the zeroed progress row in the auth hook keeps every user sortable by
 * brain power without making admin queries handle a missing progress relation.
 */
export const ensureUserProgressAfterAuthCreate: UserCreateAfterHook = async (user) => {
  await prisma.userProgress.upsert({
    create: { lastActiveAt: user.createdAt ?? new Date(), userId: user.id },
    update: {},
    where: { userId: user.id },
  });
};

/**
 * A sign-up is the account being created, whatever creates it: a guest's own row isn't one, and
 * signing in again never creates another, so analytics hear of each account once.
 */
export const reportSignUpAfterAuthCreate: UserCreateAfterHook = async (user) => {
  if (user.isAnonymous === true) {
    return;
  }

  await reportSignUp({ userId: user.id });
};
