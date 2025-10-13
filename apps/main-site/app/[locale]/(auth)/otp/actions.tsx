"use server";

import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/lib/auth";

export async function emailOTP(_initialState: unknown, formData: FormData) {
  const locale = await getLocale();
  const t = await getTranslations("Auth");
  const error = { error: t("otpError") };

  const email = formData.get("email");
  const otp = formData.get("otp");

  try {
    const data = await auth.api.signInEmailOTP({
      body: { email: String(email), otp: String(otp) },
    });

    if (!data.user) {
      return error;
    }
  } catch {
    return error;
  }

  return redirect({ href: "/", locale });
}
