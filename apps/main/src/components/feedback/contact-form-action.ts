import { parseFormField } from "@zoonk/utils/form";
import { type FeedbackPayload, sendFeedbackRequest } from "./feedback-request";

export type ContactFormState = { status: "idle" | "error" | "success" };

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
