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
