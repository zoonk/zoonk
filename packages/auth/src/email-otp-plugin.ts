import { prisma } from "@zoonk/db";
import { emailOTP } from "better-auth/plugins";
import { sendVerificationOTP } from "./plugins/otp";

/** Readable storage, so a resend can email the code that's still valid instead of a new one. */
export type EmailOTPStorage = "encrypted" | "plain";

/**
 * A resend emails the same code while it's valid: a new code would turn every earlier email into
 * a wrong code, and a learner who asked twice can't tell which email is the newest.
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
    resendStrategy: "reuse",
    sendVerificationOTP,
    storeOTP,
  });
}

const EMAIL_OTP_IDENTIFIER = /^(?:sign-in|email-verification|forget-password|change-email)-otp-/u;

/**
 * A new code replaces the email's earlier rows, such as a code that expired unused. A resend
 * refreshes the expiry by identifier alone, so with an older row beside it, it could refresh that
 * row and leave the emailed code to expire on its first deadline.
 */
export async function replaceEarlierEmailOTPs({ identifier }: { identifier: string }) {
  if (EMAIL_OTP_IDENTIFIER.test(identifier)) {
    await prisma.verification.deleteMany({ where: { identifier } });
  }
}
