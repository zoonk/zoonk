import type { SendVerificationOTP } from "@zoonk/auth";
import { sendEmail } from "@zoonk/mailer";
import { getTranslations } from "next-intl/server";

export const sendVerificationOTP: SendVerificationOTP = async (
  { email, otp },
  _request,
) => {
  const t = await getTranslations("OTP");

  const subject = t("subject");

  const text = `
      <p>${t("intro")}</p>
      <h2>${otp}</h2>
      <p>${t("expiry")}</p>
      <p>${t("ignore")}</p>
    `;

  await sendEmail({
    subject,
    text,
    to: email,
  });

  return;
};
