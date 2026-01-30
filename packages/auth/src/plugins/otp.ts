import { sendEmail } from "@zoonk/mailer";
import { LOCALE_COOKIE } from "@zoonk/utils/locale";
import { type EmailOTPOptions } from "better-auth/plugins";
import { cookies } from "next/headers";
import { after } from "next/server";
import { getTranslation } from "../translations/get-translations";

export const sendVerificationOTP: EmailOTPOptions["sendVerificationOTP"] = async (
  { email, otp },
  _request,
) => {
  const cookieStore = await cookies();
  const locale = cookieStore.get(LOCALE_COOKIE)?.value || "en";
  const t = await getTranslation(locale);

  const subject = t.otpSubject;

  const text = `
      <p>${t.otpIntro}</p>
      <h2>${otp}</h2>
      <p>${t.otpExpiry}</p>
      <p>${t.otpDisclaimer}</p>
    `;

  after(() => {
    void sendEmail({
      subject,
      text,
      to: email,
    });
  });
};
