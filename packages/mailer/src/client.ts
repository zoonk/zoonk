import { getEnvironment } from "@zoonk/utils/environment";
import { type SafeReturn, toError } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { getLocalInboxUrl } from "./local-inbox";

const apiUrl = "https://api.zeptomail.com/v1.1/email";
const localInboxUrl = getLocalInboxUrl();

/** Study reminders go through their own ZeptoMail mail agent, so their reputation stays apart from sign-in codes. */
const SENDERS = {
  hello: { address: "hello@zoonk.com", apiKeyName: "MAILER_API_KEY" },
  reminders: { address: "reminders@zoonk.com", apiKeyName: "MAILER_REMINDERS_API_KEY" },
} as const;

type SendEmailParams = {
  to: string;
  subject: string;
  htmlBody?: string;
  textBody?: string;
  replyTo?: string;
  headers?: Record<string, string>;
  sender?: keyof typeof SENDERS;
};

/** ZeptoMail refused the email; its status and `Retry-After` let the caller decide whether to try again. */
export class MailerError extends Error {
  readonly retryAfter: string | null;
  readonly status: number;

  constructor({ retryAfter, status }: { retryAfter: string | null; status: number }) {
    super(`Email send failed with status ${status}`);
    this.name = "MailerError";
    this.retryAfter = retryAfter;
    this.status = status;
  }
}

export async function sendEmail(params: SendEmailParams): Promise<SafeReturn<Response>> {
  const { to, subject, htmlBody, textBody, replyTo, headers, sender = "hello" } = params;
  const { address, apiKeyName } = SENDERS[sender];
  const apiKey = process.env[apiKeyName];

  if (!apiKey) {
    return handleMissingMailerApiKey(params);
  }

  try {
    const response = await fetch(apiUrl, {
      body: JSON.stringify({
        from: { address, name: "Zoonk" },
        ...(htmlBody && { htmlBody }),
        ...(textBody && { textbody: textBody }),
        ...(replyTo && { reply_to: [{ address: replyTo }] }),
        ...(headers && { mime_headers: headers }),
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
        error: new MailerError({
          retryAfter: response.headers.get("Retry-After"),
          status: response.status,
        }),
      };
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

  const error = new Error(
    `${SENDERS[params.sender ?? "hello"].apiKeyName} is required to send email outside development.`,
  );

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
