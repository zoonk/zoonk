import { sendEmail } from "@zoonk/mailer";
import { type EmailOTPOptions } from "better-auth/plugins";
import { after } from "next/server";
import { getRequestTranslation } from "../translations/get-translations";

export const sendVerificationOTP: EmailOTPOptions["sendVerificationOTP"] = async (
  { email, otp },
  _request,
) => {
  const t = await getRequestTranslation();

  const subject = t.otpSubject;

  const htmlBody = `
      <p>${t.otpIntro}</p>
      <h2>${otp}</h2>
      <p>${t.otpExpiry}</p>
      <p>${t.otpDisclaimer}</p>
    `;

  after(() => {
    void sendEmail({ htmlBody, subject, to: email });
  });
};
