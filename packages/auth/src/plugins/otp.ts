import { sendEmail } from "@zoonk/mailer";
import { LOCALE_COOKIE, getLocaleFromRequest } from "@zoonk/utils/locale";
import { type EmailOTPOptions } from "better-auth/plugins";
import { cookies, headers } from "next/headers";
import { after } from "next/server";
import { getTranslation } from "../translations/get-translations";

export const sendVerificationOTP: EmailOTPOptions["sendVerificationOTP"] = async (
  { email, otp },
  _request,
) => {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);

  const locale = getLocaleFromRequest({
    acceptLanguage: headerStore.get("accept-language"),
    cookieLocale: cookieStore.get(LOCALE_COOKIE)?.value,
  });

  const t = await getTranslation(locale);

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
