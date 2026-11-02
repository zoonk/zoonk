import { prisma } from "@zoonk/db";
import { betterAuth } from "better-auth/minimal";
import { type BetterAuthOptions } from "better-auth/types";
import {
  AccountDeletionEmailMismatchError,
  type EmailAccountDeletionCredentials,
} from "./email-deletion-contract";
import { type EmailOTPStorage, createEmailOTPPlugin } from "./email-otp-plugin";
import { baseAuthConfig, baseAuthPlugins } from "./server";

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

  /** Throws `AccountDeletionEmailMismatchError` when the verified email belongs to another account. */
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
        error: new AccountDeletionEmailMismatchError(
          "Email reauthorization does not match the current user",
        ),
        sessionToken: session.token,
      });
    }

    return { sessionToken: session.token } as const;
  };
}
