import { sendEmail } from "@zoonk/mailer";
import { type FeedbackContext } from "./contract";

const FEEDBACK_RECIPIENT = "hello@zoonk.com";
const FEEDBACK_SUBJECT = "Zoonk Feedback";

type SendFeedbackMessageParams = { context: FeedbackContext; email: string; message: string };

/** One "Label: value" line per context field the client sent, so the inbox shows where it came from. */
function formatContext(context: FeedbackContext): string {
  const lines = [
    context.screen && `Screen: ${context.screen}`,
    context.url && `Page: ${context.url}`,
    context.contentKind && `Content: ${context.contentKind} ${context.contentId ?? ""}`.trim(),
    context.platform && `Platform: ${context.platform}`,
    context.appVersion && `App version: ${context.appVersion}`,
  ].filter(Boolean);

  return lines.length > 0 ? `\n\n---\n${lines.join("\n")}` : "";
}

/**
 * Sends every product message to the same support inbox so web and native
 * clients share one simple feedback path.
 */
export async function sendFeedbackMessage(params: SendFeedbackMessageParams) {
  return sendEmail({
    replyTo: params.email,
    subject: FEEDBACK_SUBJECT,
    textBody: `From: ${params.email}\n\n${params.message}${formatContext(params.context)}`,
    to: FEEDBACK_RECIPIENT,
  });
}
