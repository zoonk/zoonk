"use client";

import { sendFeedbackRequest } from "@/components/feedback/feedback-request";
import {
  WaitlistField,
  WaitlistFieldLabel,
  WaitlistForm,
  WaitlistInput,
  type WaitlistState,
  WaitlistStatus,
  WaitlistSubmit,
} from "@/components/waitlist/waitlist";
import { type UnsupportedCourseStartScope } from "@/data/courses/course-start-request";
import { parseFormField } from "@zoonk/utils/form";
import { useExtracted } from "next-intl";

const COURSE_START_WAITLIST_MESSAGE_PREFIX = "Course start waitlist request";

/**
 * Builds the feedback payload for waitlisted start scopes so product requests
 * include both the learner's raw goal and the scope our router assigned.
 */
function getCourseStartWaitlistPayload(formData: FormData) {
  const email = parseFormField(formData, "email");
  const prompt = parseFormField(formData, "prompt");
  const scope = parseFormField(formData, "scope");
  const title = parseFormField(formData, "title");

  if (!(email && prompt && scope)) {
    return null;
  }

  return {
    email,
    message: [
      COURSE_START_WAITLIST_MESSAGE_PREFIX,
      "",
      `Scope: ${scope}`,
      `Prompt: ${prompt}`,
      title ? `Canonical title: ${title}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

/**
 * Sends waitlisted start-scope interest through the existing feedback endpoint
 * so the waitlist works without adding a new backend surface for this launch.
 */
async function courseStartWaitlistAction(
  _prevState: WaitlistState,
  formData: FormData,
): Promise<WaitlistState> {
  const payload = getCourseStartWaitlistPayload(formData);

  if (!payload) {
    return { status: "error" };
  }

  const sent = await sendFeedbackRequest(payload);

  return { status: sent ? "success" : "error" };
}

/**
 * Composes the generic waitlist primitives for start scopes that the router can
 * identify today but the generation workflow cannot build yet.
 */
export function CourseStartWaitlistForm({
  defaultEmail,
  prompt,
  scope,
  title,
}: {
  defaultEmail?: string | null;
  prompt: string;
  scope: UnsupportedCourseStartScope;
  title: string;
}) {
  const t = useExtracted();

  return (
    <WaitlistForm action={courseStartWaitlistAction}>
      <input name="prompt" type="hidden" value={prompt} />
      <input name="scope" type="hidden" value={scope} />
      <input name="title" type="hidden" value={title} />

      <WaitlistField>
        <WaitlistFieldLabel>{t("Email address")}</WaitlistFieldLabel>
        <WaitlistInput
          autoComplete="email"
          defaultValue={defaultEmail ?? ""}
          name="email"
          placeholder={t("myemail@gmail.com")}
          required
          type="email"
        />
      </WaitlistField>

      <WaitlistStatus
        errorMessage={t("We couldn't add you to the waitlist. Please try again.")}
        successMessage={t("You're on the list. We'll email you when it's available.")}
      />

      <WaitlistSubmit full>{t("Notify me")}</WaitlistSubmit>
    </WaitlistForm>
  );
}
