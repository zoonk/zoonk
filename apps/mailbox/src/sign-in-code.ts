import { type EmailPayload } from "./email-payload.ts";

const CODE_IN_HTML = />\s*(?<code>\d{6})\s*</u;
const CODE_IN_TEXT = /^\s*(?<code>\d{6})\s*$/mu;

/** A sign-in email shows its six digits alone in an element or on a line of their own. */
export function findSignInCode(email: Pick<EmailPayload, "htmlBody" | "textBody">): string | null {
  const match = email.htmlBody
    ? CODE_IN_HTML.exec(email.htmlBody)
    : CODE_IN_TEXT.exec(email.textBody ?? "");

  return match?.groups?.code ?? null;
}
