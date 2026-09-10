import { prisma } from "@zoonk/db";
import { getString } from "@zoonk/utils/json";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { type BetterAuthOptions } from "better-auth/types";
import { isDisposableEmail } from "./disposable-email";
import {
  DISPOSABLE_EMAIL_ERROR_CODE,
  DISPOSABLE_EMAIL_ERROR_MESSAGE,
} from "./email-signup-contract";

type UserCreateBeforeHook = NonNullable<
  NonNullable<NonNullable<BetterAuthOptions["databaseHooks"]>["user"]>["create"]
>["before"];

function disposableEmailError() {
  return new APIError("BAD_REQUEST", {
    code: DISPOSABLE_EMAIL_ERROR_CODE,
    message: DISPOSABLE_EMAIL_ERROR_MESSAGE,
  });
}

/** Enforces signup policy for OTP, OAuth, and native user creation without restricting login. */
export const validateEmailBeforeUserCreate: UserCreateBeforeHook = async (user) => {
  if (isDisposableEmail(user.email)) {
    throw disposableEmailError();
  }

  return { data: user };
};

/** Rejects new disposable signups before OTP storage and delivery; existing users retain access. */
export const validateEmailBeforeOTP = createAuthMiddleware(async (context) => {
  if (context.path !== "/email-otp/send-verification-otp") {
    return;
  }

  const email = getString(context.body, "email");

  if (getString(context.body, "type") !== "sign-in" || !email || !isDisposableEmail(email)) {
    return;
  }

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

  if (!user) {
    throw disposableEmailError();
  }
});
