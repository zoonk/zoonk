import { APIError } from "better-auth/api";
import { type BetterAuthOptions } from "better-auth/types";
import { ACCESS_ERROR_CODES } from "../access-contract";
import { assertSignUpEmailAllowed } from "../email-signup-policy";
import { getNetworkKey } from "../request-guards/network-key";
import { RATE_LIMIT_RULES, isRateLimited } from "../request-guards/rate-limit";
import { findRequestGuest } from "./guest-request";
import { isChildProfile, underMinimumAgeError } from "./link-guest-account";

type UserCreateBeforeHook = NonNullable<
  NonNullable<
    NonNullable<NonNullable<BetterAuthOptions["databaseHooks"]>["user"]>["create"]
  >["before"]
>;

/**
 * Guards every new account, whatever sign-up method creates it: the email policy, no account for a
 * guest who said they're under 13, and a generous cap on new accounts per network and browser
 * fingerprint against account farming. Guest users are guarded where they're created instead.
 */
export const guardUserCreation: UserCreateBeforeHook = async (user, context) => {
  assertSignUpEmailAllowed(user.email);

  if (user.isAnonymous === true || !context) {
    return { data: user };
  }

  const guest = await findRequestGuest(context);

  if (guest && isChildProfile(guest.learningProfile)) {
    throw underMinimumAgeError();
  }

  const requestHeaders = context.headers ?? new Headers();

  const isLimited = await isRateLimited({
    key: getNetworkKey(requestHeaders),
    requestHeaders,
    rule: RATE_LIMIT_RULES.signUp,
  });

  if (isLimited) {
    throw new APIError("TOO_MANY_REQUESTS", {
      code: ACCESS_ERROR_CODES.signUpLimitReached,
      message: "Too many new accounts from this network today. Try again later.",
    });
  }

  return { data: user };
};
