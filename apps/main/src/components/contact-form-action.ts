"use server";

import { sendEmail } from "@zoonk/mailer";

export async function contactFormAction(
  _prevState: unknown,
  formData: FormData,
) {
  const email = String(formData.get("email"));
  const message = String(formData.get("message"));

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
