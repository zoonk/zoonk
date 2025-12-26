"use server";

import { sendEmail } from "@zoonk/core/mailer/send";
import { parseFormField } from "@zoonk/utils/form";

export async function contactFormAction(
  _prevState: unknown,
  formData: FormData,
) {
  const email = parseFormField(formData, "email");
  const message = parseFormField(formData, "message");

  if (!(email && message)) {
    return { status: "error" };
  }

  const { error } = await sendEmail({
    subject: "Zoonk Request",
    text: `
        <p><strong>From:</strong> ${email}</p>
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, "<br>")}</p>
      `,
    to: "hello@zoonk.com",
  });

  if (error) {
    return { status: "error" };
  }

  return { status: "success" };
}
