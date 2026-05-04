import { sendEmail } from "@zoonk/mailer";

const FEEDBACK_RECIPIENT = "hello@zoonk.com";
const FEEDBACK_SUBJECT = "Zoonk Feedback";

type SendFeedbackMessageParams = { email: string; message: string };

/**
 * Sends every product message to the same support inbox so web and native
 * clients share one simple feedback path.
 */
export async function sendFeedbackMessage(params: SendFeedbackMessageParams) {
  return sendEmail({
    replyTo: params.email,
    subject: FEEDBACK_SUBJECT,
    textBody: `From: ${params.email}\n\n${params.message}`,
    to: FEEDBACK_RECIPIENT,
  });
}
