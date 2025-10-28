"use server";

import { sendEmail } from "@zoonk/mailer";

export async function contactFormAction(
  _prevState: unknown,
  formData: FormData,
) {
  const email = String(formData.get("email"));
  const message = String(formData.get("message"));

  try {
    const res = await sendEmail({
      subject: "Zoonk Request",
      text: `
        <p><strong>From:</strong> ${email}</p>
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, "<br>")}</p>
      `,
      to: "hello@zoonk.com",
    });

    if (!res.ok) {
      console.error("Failed to send email", await res.text());
      return { status: "error" };
    }

    return { status: "success" };
  } catch {
    console.error("Failed to send email");
    return { status: "error" };
  }
}
