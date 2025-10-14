import { sendEmail } from "@zoonk/mailer";
import type { EmailOTPOptions } from "better-auth/plugins";
import { getTranslations } from "next-intl/server";

export const sendVerificationOTP: EmailOTPOptions["sendVerificationOTP"] =
  async ({ email, otp }, _request) => {
    const t = await getTranslations("OTP");

    const subject = t("subject");

    const text = `
      <p>${t("intro")}</p>
      <h2>${otp}</h2>
      <p>${t("expiry")}</p>
      <p>${t("ignore")}</p>
    `;

    await sendEmail({
      to: email,
      subject,
      text,
    });

    return;
  };
