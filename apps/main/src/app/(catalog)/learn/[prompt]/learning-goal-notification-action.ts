"use server";

import { type LearningGoalResult } from "@/data/courses/course-suggestions";
import { getSession } from "@zoonk/core/users/session/get";
import { safeAsync } from "@zoonk/utils/error";
import { parseFormField } from "@zoonk/utils/form";
import { FEEDBACK_URL } from "@zoonk/utils/url";

export type LearningGoalNotificationState = { status: "idle" | "error" | "success" };

type ComingSoonGoal = Extract<LearningGoalResult, { kind: "comingSoon" }>["goal"];
type LearningGoalNotificationParams = { goal: ComingSoonGoal; prompt: string };

/**
 * Chooses the safest email source for a notification request. Logged-in users
 * should never need to type their email again, and checking the session inside
 * the action avoids trusting a client-supplied hidden field for authenticated
 * requests.
 */
function getNotificationEmail({
  formData,
  sessionEmail,
}: {
  formData: FormData;
  sessionEmail?: string | null;
}): string | null {
  return sessionEmail ?? parseFormField(formData, "email");
}

/**
 * Turns an unavailable learning goal into a support inbox message so we can
 * gauge demand for each routed mode without adding a separate waitlist data
 * model before the product surface is ready.
 */
function getNotificationMessage({
  email,
  goal,
  prompt,
}: LearningGoalNotificationParams & { email: string }): string {
  return [
    "Learning goal availability request",
    "",
    `Email: ${email}`,
    `Goal type: ${goal}`,
    `Prompt: ${prompt}`,
  ].join("\n");
}

/**
 * Sends availability requests through the same feedback endpoint used by the
 * rest of the app, keeping validation, abuse controls, and mail delivery in
 * one public API path.
 */
async function sendNotificationRequest({
  email,
  message,
}: {
  email: string;
  message: string;
}): Promise<boolean> {
  const { data: response, error } = await safeAsync(() =>
    fetch(FEEDBACK_URL, {
      body: JSON.stringify({ email, message }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }),
  );

  return Boolean(response?.ok && !error);
}

/**
 * Handles the coming-soon CTA for both signed-in and guest learners. The UI
 * decides whether to show an email field, while this action owns the final
 * email choice and delivery status.
 */
export async function learningGoalNotificationAction(
  params: LearningGoalNotificationParams,
  _prevState: LearningGoalNotificationState,
  formData: FormData,
): Promise<LearningGoalNotificationState> {
  const session = await getSession();
  const email = getNotificationEmail({ formData, sessionEmail: session?.user.email });

  if (!email) {
    return { status: "error" };
  }

  const sent = await sendNotificationRequest({
    email,
    message: getNotificationMessage({ ...params, email }),
  });

  return { status: sent ? "success" : "error" };
}
