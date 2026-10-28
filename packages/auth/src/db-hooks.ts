import { prisma } from "@zoonk/db";
import { reportSignUp } from "./sign-up-events";
import { type UserCreateAfterHook } from "./user-create-hooks";

export const ensureUserProgressAfterAuthCreate: UserCreateAfterHook = async (user) => {
  await prisma.userProgress.upsert({
    create: { lastActiveAt: user.createdAt ?? new Date(), userId: user.id },
    update: {},
    where: { userId: user.id },
  });
};

export const reportSignUpAfterAuthCreate: UserCreateAfterHook = async (user) => {
  if (user.isAnonymous === true) {
    return;
  }

  await reportSignUp({ userId: user.id });
};
