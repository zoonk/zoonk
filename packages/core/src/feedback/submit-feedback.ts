import "server-only";
import { prisma } from "@zoonk/db";
import { logError } from "@zoonk/utils/logger";
import { getSession } from "../users/get-session";
import { findContentProvenance } from "./_utils/content-provenance";
import { type FeedbackContext, type FeedbackMessageInput } from "./contract";
import { sendFeedbackMessage } from "./send-feedback-message";

/**
 * Adds the model, prompt version and run behind the content the message is about, when the sender
 * can see it, so messages can be read per model and prompt version like votes.
 */
async function getStoredContext({
  context,
  userId,
}: {
  context: FeedbackContext;
  userId: string | null;
}) {
  if (!(context.contentKind && context.contentId)) {
    return context;
  }

  const provenance = await findContentProvenance({
    contentId: context.contentId,
    contentKind: context.contentKind,
    userId,
  });

  return provenance ? { ...context, provenance } : context;
}

/**
 * Stores a feedback message with its context and emails it to the team. Anyone can send one; a
 * signed-in learner's message is linked to their account. The stored message is the record, so an
 * email failure is logged instead of failing a message that was already saved.
 */
export async function submitFeedback({ context = {}, email, message }: FeedbackMessageInput) {
  const session = await getSession();
  const userId = session?.user.id ?? null;

  const feedback = await prisma.feedback.create({
    data: { context: await getStoredContext({ context, userId }), email, message, userId },
  });

  const { error } = await sendFeedbackMessage({ context, email, message });

  if (error) {
    logError("[submitFeedback] Failed to email feedback:", { error, feedbackId: feedback.id });
  }

  return feedback;
}
