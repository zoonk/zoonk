import { type BetterAuthOptions } from "better-auth/types";

type UserCreateHooks = NonNullable<
  NonNullable<NonNullable<BetterAuthOptions["databaseHooks"]>["user"]>["create"]
>;

export type UserCreateBeforeHook = NonNullable<UserCreateHooks["before"]>;
export type UserCreateAfterHook = NonNullable<UserCreateHooks["after"]>;
