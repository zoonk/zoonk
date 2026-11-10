import { sendEmail } from "@zoonk/mailer";
import { type FeedbackContext } from "./contract";

const FEEDBACK_RECIPIENT = "hello@zoonk.com";
const FEEDBACK_SUBJECT = "Zoonk Feedback";

type SendFeedbackMessageParams = {
  context: FeedbackContext;
  email: string | null;
  message: string;
  subject?: string;
};

function formatContext(context: FeedbackContext): string {
  const lines = [
    context.reportType && `Report: ${context.reportType}`,
    context.screen && `Screen: ${context.screen}`,
    context.url && `Page: ${context.url}`,
    context.contentKind && `Content: ${context.contentKind} ${context.contentId ?? ""}`.trim(),
    context.platform && `Platform: ${context.platform}`,
    context.appVersion && `App version: ${context.appVersion}`,
  ].filter(Boolean);

  return lines.length > 0 ? `\n\n---\n${lines.join("\n")}` : "";
}

export async function sendFeedbackMessage(params: SendFeedbackMessageParams) {
  return sendEmail({
    ...(params.email ? { replyTo: params.email } : {}),
    subject: params.subject ?? FEEDBACK_SUBJECT,
    textBody: `From: ${params.email ?? "no email"}\n\n${params.message}${formatContext(params.context)}`,
    to: FEEDBACK_RECIPIENT,
  });
}
