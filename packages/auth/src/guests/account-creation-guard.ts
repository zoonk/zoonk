import { type BetterAuthOptions } from "better-auth/types";
import { assertSignUpEmailAllowed } from "../email-signup-policy";

type UserCreateBeforeHook = NonNullable<
  NonNullable<
    NonNullable<NonNullable<BetterAuthOptions["databaseHooks"]>["user"]>["create"]
  >["before"]
>;

/**
 * Guards every new account, whatever sign-up method creates it, with the email policy. Guest users
 * are guarded where they're created instead.
 */
export const guardUserCreation: UserCreateBeforeHook = async (user) => {
  assertSignUpEmailAllowed(user.email);
  return { data: user };
};
