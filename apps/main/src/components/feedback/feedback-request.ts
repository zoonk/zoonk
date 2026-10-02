import { postFromBrowser } from "@/lib/api/browser-api";
import { type FeedbackMessageInput } from "@zoonk/core/feedback/contract";

/**
 * Sends feedback through the public API endpoint so every UI surface gets the
 * same validation, quota protection, storage, and email delivery behavior. A
 * signed-in learner's bearer token links the message to their account.
 */
export async function sendFeedbackRequest(payload: FeedbackMessageInput): Promise<boolean> {
  const response = await postFromBrowser({ body: payload, path: "/v1/feedback" });
  return Boolean(response?.ok);
}
