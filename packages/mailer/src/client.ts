import { type SafeReturn, toError } from "@zoonk/utils/error";
import { logError, logInfo } from "@zoonk/utils/logger";

const apiUrl = "https://api.zeptomail.com/v1.1/email";
const apiKey = process.env.MAILER_API_KEY;
const sendEmailDisabled = !apiKey;

export async function sendEmail({
  to,
  subject,
  htmlBody,
  textBody,
  replyTo,
}: {
  to: string;
  subject: string;
  htmlBody?: string;
  textBody?: string;
  replyTo?: string;
}): Promise<SafeReturn<Response>> {
  if (sendEmailDisabled) {
    logInfo("Email sending is disabled.");
    logInfo({ subject, textBody: textBody ?? htmlBody, to });
    return { data: Response.json({ ok: true }), error: null };
  }

  try {
    const response = await fetch(apiUrl, {
      body: JSON.stringify({
        from: { address: "hello@zoonk.com", name: "Zoonk" },
        ...(htmlBody && { htmlBody }),
        ...(textBody && { textbody: textBody }),
        ...(replyTo && { reply_to: [{ address: replyTo }] }),
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
      logError("Email send failed", await response.text());

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
