"use server";

import { sendVerificationOTP } from "@zoonk/core/users";
import { parseFormField } from "@zoonk/utils/form";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";

export async function sendVerificationOTPAction(formData: FormData) {
  const email = parseFormField(formData, "email");
  const redirectTo = parseFormField(formData, "redirectTo");

  if (!email) {
    return;
  }

  await sendVerificationOTP(email);

  const locale = await getLocale();

  redirect({
    href: {
      pathname: "/otp",
      query: {
        email,
        ...(redirectTo ? { redirectTo } : {}),
      },
    },
    locale,
  });
}
