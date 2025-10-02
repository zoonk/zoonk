"use server";

import { sendEmail } from "@/lib/email-client";

export async function contactFormAction(
  _prevState: unknown,
  formData: FormData,
) {
  const email = formData.get("email") as string;
  const message = formData.get("message") as string;

  try {
    await sendEmail({
      to: "hello@zoonk.com",
      subject: "Zoonk Request",
      text: `
        <p><strong>From:</strong> ${email}</p>
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, "<br>")}</p>
      `,
    });
    return { status: "success" };
  } catch {
    console.error("Failed to send email");
    return { status: "error" };
  }
}
