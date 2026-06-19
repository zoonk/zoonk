import { safeAsync } from "@zoonk/utils/error";
import { API_URL } from "@zoonk/utils/url";

export type FeedbackPayload = { email: string; message: string };

const FEEDBACK_URL = new URL("/v1/feedback", API_URL).toString();

/**
 * Sends feedback through the public API endpoint so every UI surface gets the
 * same validation, quota protection, and email delivery behavior.
 */
export async function sendFeedbackRequest(payload: FeedbackPayload): Promise<boolean> {
  const { data: response, error } = await safeAsync(() =>
    fetch(FEEDBACK_URL, {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }),
  );

  return Boolean(response?.ok && !error);
}
