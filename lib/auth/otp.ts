import type { EmailOTPOptions } from "better-auth/plugins";
import { getTranslations } from "next-intl/server";
import { sendEmail } from "../email-client";

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

    return sendEmail({
      to: email,
      subject,
      text,
    });
  };
