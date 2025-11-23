// biome-ignore-all lint/style/useNamingConvention: external API requirement

import { type SafeReturn, toError } from "@zoonk/utils/error";

const apiUrl = "https://api.zeptomail.com/v1.1/email";
const apiKey = process.env.MAILER_API_KEY;
const sendEmailDisabled = !apiKey;

type EmailProps = {
  to: string;
  subject: string;
  text: string;
};

export async function sendEmail({
  to,
  subject,
  text,
}: EmailProps): Promise<SafeReturn<Response>> {
  if (sendEmailDisabled) {
    console.info("Email sending is disabled.");
    console.info({ subject, text, to });
    return Promise.resolve({ data: Response.json({ ok: true }), error: null });
  }

  try {
    const response = await fetch(apiUrl, {
      body: JSON.stringify({
        from: { address: "hello@zoonk.com", name: "Zoonk" },
        htmlBody: text,
        subject,
        to: [{ email_address: { address: to } }],
      }),
      headers: {
        Accept: "application/json",
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    if (!response.ok) {
      console.error("Email send failed", await response.text());

      return {
        data: null,
        error: new Error(`Email send failed: ${response.statusText}`),
      };
    }

    return { data: response, error: null };
  } catch (error) {
    return { data: null, error: toError(error) };
  }
}
