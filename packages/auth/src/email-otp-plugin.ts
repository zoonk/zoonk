import { type EmailOTPOptions, emailOTP } from "better-auth/plugins";
import { sendVerificationOTP } from "./plugins/otp";

export type EmailOTPStorage = NonNullable<EmailOTPOptions["storeOTP"]>;

/**
 * Keeps the production, E2E, and deletion-only Better Auth instances on the
 * same email delivery and OTP storage contract. Deletion opts out of signup,
 * while the normal login instances retain the existing signup behavior.
 */
export function createEmailOTPPlugin({
  disableSignUp = false,
  storeOTP,
}: {
  disableSignUp?: boolean;
  storeOTP: EmailOTPStorage;
}) {
  return emailOTP({
    disableSignUp,
    overrideDefaultEmailVerification: true,
    sendVerificationOTP,
    storeOTP,
  });
}
