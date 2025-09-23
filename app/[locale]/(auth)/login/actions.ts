"use server";

import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { sendVerificationOTP } from "@/lib/user";

export async function sendVerificationOTPAction(formData: FormData) {
  const locale = await getLocale();

  const email = formData.get("email") as string;

  await sendVerificationOTP(email);

  redirect({ href: { pathname: "/otp", query: { email } }, locale });
}
