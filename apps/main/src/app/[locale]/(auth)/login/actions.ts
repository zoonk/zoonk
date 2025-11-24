"use server";

import { sendVerificationOTP } from "@zoonk/api/users";
import { parseFormField } from "@zoonk/utils/form";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";

export async function sendVerificationOTPAction(formData: FormData) {
  const locale = await getLocale();
  const email = parseFormField(formData, "email");

  if (!email) {
    return;
  }

  await sendVerificationOTP(email);

  redirect({ href: { pathname: "/otp", query: { email } }, locale });
}
