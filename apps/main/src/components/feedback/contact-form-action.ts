import { safeAsync } from "@zoonk/utils/error";
import { parseFormField } from "@zoonk/utils/form";
import { API_URL } from "@zoonk/utils/url";

export type ContactFormState = { status: "idle" | "error" | "success" };

type FeedbackPayload = { email: string; message: string };

const FEEDBACK_URL = new URL("/v1/feedback", API_URL).toString();

/**
 * Normalizes the form before sending it to the API so the UI can fail fast for
 * empty messages while the public API remains the source of truth for feedback
 * validation and abuse controls.
 */
function getFeedbackPayload(formData: FormData): FeedbackPayload | null {
  const email = parseFormField(formData, "email");
  const message = parseFormField(formData, "message");

  if (!(email && message)) {
    return null;
  }

  return { email, message };
}

/**
 * Sends web feedback through the same public endpoint native clients use so
 * quota protection stays attached to one ingestion path instead of each UI
 * surface calling the mailer directly.
 */
async function sendFeedbackRequest(payload: FeedbackPayload): Promise<boolean> {
  const { data: response, error } = await safeAsync(() =>
    fetch(FEEDBACK_URL, {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }),
  );

  return Boolean(response?.ok && !error);
}

/**
 * Handles the browser form submission and maps API failures back to the small
 * state shape the dialog already understands.
 */
export async function contactFormAction(
  _prevState: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const payload = getFeedbackPayload(formData);

  if (!payload) {
    return { status: "error" };
  }

  const sent = await sendFeedbackRequest(payload);

  return { status: sent ? "success" : "error" };
}
