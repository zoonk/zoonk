import "server-only";
import { prisma } from "@zoonk/db";
import { logError } from "@zoonk/utils/logger";
import { type StoredFeedbackContext } from "../contract";
import { sendFeedbackMessage } from "../send-feedback-message";

/**
 * Saves a message to the admin inbox and emails it to the team. Once it's saved, an email failure is
 * logged, never thrown: the inbox already has it.
 */
export async function saveFeedbackMessage({
  context,
  email,
  message,
  subject,
  userId,
}: {
  context: StoredFeedbackContext;
  email: string;
  message: string;
  subject?: string;
  userId: string | null;
}) {
  const feedback = await prisma.feedback.create({ data: { context, email, message, userId } });
  const { error } = await sendFeedbackMessage({ context, email, message, subject });

  if (error) {
    logError("[saveFeedbackMessage] Failed to email feedback:", { error, feedbackId: feedback.id });
  }

  return feedback;
}
