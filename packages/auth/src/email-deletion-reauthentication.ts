import { prisma } from "@zoonk/db";
import { betterAuth } from "better-auth/minimal";
import { type BetterAuthOptions } from "better-auth/types";
import {
  type EmailAccountDeletionCredentials,
  EmailAccountDeletionError,
} from "./email-deletion-contract";
import { type EmailOTPStorage, createEmailOTPPlugin } from "./email-otp-plugin";
import { baseAuthConfig, baseAuthPlugins } from "./server";

/**
 * Removes the session created after a valid OTP before rejecting an identity
 * mismatch. A user must never retain a session for another account merely
 * because they entered that account's code during deletion reauthentication.
 */
async function throwAfterSessionCleanup({
  error,
  sessionToken,
}: {
  error: unknown;
  sessionToken: string;
}): Promise<never> {
  try {
    await prisma.session.deleteMany({ where: { token: sessionToken } });
  } catch (cleanupError) {
    throw new Error("Email reauthentication session cleanup failed", { cause: cleanupError });
  }

  throw error;
}

/**
 * Builds a server-only Better Auth email OTP verifier that can authenticate an
 * existing user but can never create one. Calling `signInEmailOTP` consumes the
 * OTP atomically and returns the fresh session required by account deletion.
 */
export function createEmailDeletionReauthentication({
  rateLimit,
  storeOTP,
}: {
  rateLimit: NonNullable<BetterAuthOptions["rateLimit"]>;
  storeOTP: EmailOTPStorage;
}) {
  const emailDeletionAuth = betterAuth({
    ...baseAuthConfig,
    plugins: [...baseAuthPlugins, createEmailOTPPlugin({ disableSignUp: true, storeOTP })],
    rateLimit,
  });

  /**
   * Verifies the code and then binds the resulting fresh session to the user
   * from the original bearer request. This comparison prevents a valid code
   * for another Zoonk account from authorizing the caller's deletion request.
   */
  return async function reauthorizeEmailForAccountDeletion({
    credentials,
    expectedUserId,
  }: {
    credentials: EmailAccountDeletionCredentials;
    expectedUserId: string;
  }) {
    const session = await emailDeletionAuth.api.signInEmailOTP({ body: credentials });

    if (session.user.id !== expectedUserId) {
      return throwAfterSessionCleanup({
        error: new EmailAccountDeletionError(
          "Email reauthorization does not match the current user",
        ),
        sessionToken: session.token,
      });
    }

    return { sessionToken: session.token } as const;
  };
}
