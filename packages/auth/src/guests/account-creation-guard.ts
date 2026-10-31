import { assertSignUpEmailAllowed } from "../email-signup-policy";
import { type UserCreateBeforeHook } from "../user-create-hooks";

export const guardUserCreation: UserCreateBeforeHook = async (user) => {
  assertSignUpEmailAllowed(user.email);
  return { data: user };
};
