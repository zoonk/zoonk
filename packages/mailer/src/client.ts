import { getEnvironment } from "@zoonk/utils/environment";
import { type SafeReturn, toError } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { getLocalInboxUrl } from "./local-inbox";

const apiUrl = "https://api.zeptomail.com/v1.1/email";
const localInboxUrl = getLocalInboxUrl();

type SendEmailParams = {
  to: string;
  subject: string;
  htmlBody?: string;
  textBody?: string;
  replyTo?: string;
};

export async function sendEmail(params: SendEmailParams): Promise<SafeReturn<Response>> {
  const { to, subject, htmlBody, textBody, replyTo } = params;
  const apiKey = process.env.MAILER_API_KEY;

  if (!apiKey) {
    return handleMissingMailerApiKey(params);
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

      return { data: null, error: new Error(`Email send failed: ${response.statusText}`) };
    }

    return { data: response, error: null };
  } catch (error) {
    return { data: null, error: toError(error) };
  }
}

/** Outside development, a missing key fails instead of logging the email, so sign-in codes never reach logs. */
async function handleMissingMailerApiKey(params: SendEmailParams): Promise<SafeReturn<Response>> {
  if (getEnvironment() === "development") {
    return captureDevelopmentEmail(params);
  }

  if (getEnvironment() === "e2e") {
    return { data: Response.json({ ok: true }), error: null };
  }

  const error = new Error("MAILER_API_KEY is required to send email outside development.");

  logError("Email send failed", error.message);

  return { data: null, error };
}

async function captureDevelopmentEmail(params: SendEmailParams): Promise<SafeReturn<Response>> {
  try {
    const response = await fetch(localInboxUrl, {
      body: JSON.stringify(params),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    if (!response.ok) {
      const error = new Error(`Local email capture failed: ${response.statusText}`);

      logError(error.message);

      return { data: null, error };
    }

    return { data: response, error: null };
  } catch (error) {
    const normalizedError = toError(error);

    logError(`Local email inbox is unavailable at ${localInboxUrl}. Run pnpm dev to start it.`);

    return { data: null, error: normalizedError };
  }
}
