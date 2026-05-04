"use server";

import { sendFeedbackMessage } from "@zoonk/core/feedback/send";
import { parseFormField } from "@zoonk/utils/form";

export async function contactFormAction(_prevState: unknown, formData: FormData) {
  const email = parseFormField(formData, "email");
  const message = parseFormField(formData, "message");

  if (!(email && message)) {
    return { status: "error" };
  }

  const { error } = await sendFeedbackMessage({ email, message });

  if (error) {
    return { status: "error" };
  }

  return { status: "success" };
}
