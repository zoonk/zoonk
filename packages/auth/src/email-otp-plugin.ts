import { type EmailOTPOptions, emailOTP } from "better-auth/plugins";
import { sendVerificationOTP } from "./plugins/otp";

export type EmailOTPStorage = NonNullable<EmailOTPOptions["storeOTP"]>;

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
