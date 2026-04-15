"use server";

import { sendEmail } from "@zoonk/core/mailer/send";
import { parseFormField } from "@zoonk/utils/form";

export async function contactFormAction(_prevState: unknown, formData: FormData) {
  const email = parseFormField(formData, "email");
  const message = parseFormField(formData, "message");

  if (!(email && message)) {
    return { status: "error" };
  }

  const { error } = await sendEmail({
    replyTo: email,
    subject: "Zoonk Request",
    textBody: `From: ${email}\n\n${message}`,
    to: "hello@zoonk.com",
  });

  if (error) {
    return { status: "error" };
  }

  return { status: "success" };
}
