import { prisma } from "@zoonk/db";
import { type BetterAuthOptions } from "better-auth/types";

type UserCreateAfterHook = NonNullable<
  NonNullable<NonNullable<BetterAuthOptions["databaseHooks"]>["user"]>["create"]
>["after"];

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
