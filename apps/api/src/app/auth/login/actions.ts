"use server";

import { sendVerificationOTP } from "@zoonk/core/users/otp/send";
import { parseFormField } from "@zoonk/utils/form";
import { redirect } from "next/navigation";

export async function sendVerificationOTPAction(formData: FormData) {
  const email = parseFormField(formData, "email");
  const redirectTo = parseFormField(formData, "redirectTo");

  if (!email) {
    return;
  }

  await sendVerificationOTP(email);

  const params = new URLSearchParams({ email });

  if (redirectTo) {
    params.set("redirectTo", redirectTo);
  }

  redirect(`/auth/otp?${params.toString()}`);
}
