import { getBrowserApiUrl } from "@/lib/browser-api-url";
import { safeAsync } from "@zoonk/utils/error";

export type FeedbackPayload = { email: string; message: string };

/**
 * Sends feedback through the public API endpoint so every UI surface gets the
 * same validation, quota protection, and email delivery behavior.
 */
export async function sendFeedbackRequest(payload: FeedbackPayload): Promise<boolean> {
  const { data: response, error } = await safeAsync(() =>
    fetch(new URL("/v1/feedback", getBrowserApiUrl()), {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }),
  );

  return Boolean(response?.ok && !error);
}
