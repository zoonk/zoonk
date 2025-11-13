import type { SendVerificationOTP } from "@zoonk/auth";
import { sendEmail } from "@zoonk/mailer";
import { getExtracted } from "next-intl/server";

export const sendVerificationOTP: SendVerificationOTP = async (
  { email, otp },
  _request,
) => {
  const t = await getExtracted();

  const subject = t("Your Zoonk sign-in code");

  const text = `
      <p>${t("This is your one-time passcode to sign in to Zoonk:")}</p>
      <h2>${otp}</h2>
      <p>${t("This code will expire in 5 minutes.")}</p>
      <p>${t("If you did not request this code, you can safely ignore this email.")}</p>
    `;

  await sendEmail({
    subject,
    text,
    to: email,
  });

  return;
};
