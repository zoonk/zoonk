import { sendEmail } from "@zoonk/mailer";
import { type EmailOTPOptions } from "better-auth/plugins";
import { after } from "next/server";
import { EMAIL_MONO_FONT, EMAIL_MUTED_COLOR, EMAIL_TEXT_STYLE } from "../email-style";
import { getRequestTranslation } from "../translations/get-translations";

export const sendVerificationOTP: EmailOTPOptions["sendVerificationOTP"] = async (
  { email, otp },
  _request,
) => {
  const t = await getRequestTranslation();

  const subject = t.otpSubject.replace("{code}", otp);

  const htmlBody = `<div style="${EMAIL_TEXT_STYLE}"><p style="margin:0 0 6px;color:${EMAIL_MUTED_COLOR}">${t.otpIntro}</p><p style="margin:0 0 20px;font-family:${EMAIL_MONO_FONT};font-size:36px;line-height:1.1;font-weight:600;letter-spacing:0.08em">${otp}</p><p style="margin:0 0 24px">${t.otpExpiry}</p><p style="margin:0;font-size:12px;color:${EMAIL_MUTED_COLOR}">${t.otpDisclaimer}</p></div>`;

  after(() => {
    void sendEmail({ htmlBody, subject, to: email });
  });
};
