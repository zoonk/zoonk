"use server";

import { sendVerificationOTP } from "@zoonk/api/users";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";

export async function sendVerificationOTPAction(formData: FormData) {
  const locale = await getLocale();

  const email = formData.get("email") as string;

  await sendVerificationOTP(email);

  redirect({ href: { pathname: "/otp", query: { email } }, locale });
}
