import { getEnvironment } from "@zoonk/utils/environment";
import { type SafeReturn, toError } from "@zoonk/utils/error";
import { logError, logInfo } from "@zoonk/utils/logger";

const apiUrl = "https://api.zeptomail.com/v1.1/email";

type SendEmailParams = {
  to: string;
  subject: string;
  htmlBody?: string;
  textBody?: string;
  replyTo?: string;
};

/**
 * Sends product emails through the configured provider while preserving the
 * local development workflow where missing credentials print OTP emails to the
 * terminal. Deployed environments must fail closed so a missing secret cannot
 * turn authentication codes into application logs.
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
function handleMissingMailerApiKey(params: SendEmailParams): SafeReturn<Response> {
  if (isMissingMailerApiKeyAllowed()) {
    logDisabledEmail(params);

    return { data: Response.json({ ok: true }), error: null };
  }

  const error = new Error("MAILER_API_KEY is required to send email outside development.");

  logError("Email send failed", error.message);

  return { data: null, error };
}

/**
 * Allows no-provider email only in environments that are not real mail
 * delivery surfaces. E2E reads OTPs from the database, while local development
 * prints them for manual login.
 */
function isMissingMailerApiKeyAllowed(): boolean {
  const environment = getEnvironment();

  return environment === "development" || environment === "e2e";
}

/**
 * Logs disabled-mailer output without treating every non-provider environment
 * the same. Developers need the body locally to copy OTP codes, but E2E and any
 * future non-delivery mode should keep secret-bearing content out of logs.
 */
function logDisabledEmail(params: SendEmailParams): void {
  logInfo("Email sending is disabled.");
  logInfo(getDisabledEmailLogPayload(params));
}

/**
 * Keeps the redaction rule explicit at the payload boundary so future mail
 * fields do not accidentally reintroduce OTP or message-body logging outside
 * local development.
 */
function getDisabledEmailLogPayload({ subject, textBody, htmlBody, to }: SendEmailParams) {
  if (getEnvironment() === "development") {
    return { subject, textBody: textBody ?? htmlBody, to };
  }

  return { subject, to };
}
