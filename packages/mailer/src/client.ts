import { getEnvironment } from "@zoonk/utils/environment";
import { type SafeReturn, toError } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { getLocalInboxConfig } from "./local-inbox";

const apiUrl = "https://api.zeptomail.com/v1.1/email";
const { url: localInboxUrl } = getLocalInboxConfig();

type SendEmailParams = {
  to: string;
  subject: string;
  htmlBody?: string;
  textBody?: string;
  replyTo?: string;
};

/**
 * Sends product emails through the configured provider while preserving the
 * local development workflow where missing credentials capture messages in a
 * browser inbox. Deployed environments must fail closed so a missing secret
 * cannot turn authentication codes into application logs.
 */
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

/**
 * Handles missing credentials in the one place that knows whether email is
 * optional. Local development needs a disabled-mailer mode for OTP login, but
 * previews and production should expose the configuration problem immediately.
 */
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

/**
 * Delivers a development message to the local-only Vite app instead of mixing
 * HTML and sign-in codes into terminal output. The endpoint is bound to the
 * loopback interface and exists only while the mailbox development server runs.
 */
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
