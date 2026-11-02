import { postFromBrowser } from "@/lib/api/browser-api";
import { type FeedbackMessageInput } from "@zoonk/core/feedback/contract";

export async function sendFeedbackRequest(payload: FeedbackMessageInput): Promise<boolean> {
  const response = await postFromBrowser({ body: payload, path: "/v1/feedback" });
  return Boolean(response?.ok);
}
