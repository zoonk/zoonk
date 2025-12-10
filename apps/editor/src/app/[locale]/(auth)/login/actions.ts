"use server";

import { sendVerificationOTP } from "@zoonk/core/users";
import { parseFormField } from "@zoonk/utils/form";
import { redirect } from "next/navigation";

export async function sendVerificationOTPAction(formData: FormData) {
  const email = parseFormField(formData, "email");

  if (!email) {
    return;
  }

  await sendVerificationOTP(email);

  redirect(`/otp?email=${encodeURIComponent(email)}`);
}
