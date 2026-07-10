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
import { type UnsupportedCoursePrompt } from "@/data/courses/course-prompt";
import { parseFormField } from "@zoonk/utils/form";
import { useExtracted } from "next-intl";

const COURSE_PROMPT_WAITLIST_MESSAGE_PREFIX = "Course prompt waitlist request";

/**
 * Builds the feedback payload for waitlisted course prompts so product requests
 * include both the learner's raw goal and the intent and format our router assigned.
 */
function getCoursePromptWaitlistPayload(formData: FormData) {
  const courseFormat = parseFormField(formData, "courseFormat");
  const email = parseFormField(formData, "email");
  const prompt = parseFormField(formData, "prompt");
  const intent = parseFormField(formData, "intent");
  const title = parseFormField(formData, "title");

  if (!(email && prompt && intent)) {
    return null;
  }

  return {
    email,
    message: [
      COURSE_PROMPT_WAITLIST_MESSAGE_PREFIX,
      "",
      `Prompt intent: ${intent}`,
      courseFormat ? `Course format: ${courseFormat}` : null,
      `Prompt: ${prompt}`,
      title ? `Canonical title: ${title}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

/**
 * Sends waitlisted course-prompt interest through the existing feedback endpoint
 * so the waitlist works without adding a new backend surface for this launch.
 */
async function coursePromptWaitlistAction(
  _prevState: WaitlistState,
  formData: FormData,
): Promise<WaitlistState> {
  const payload = getCoursePromptWaitlistPayload(formData);

  if (!payload) {
    return { status: "error" };
  }

  const sent = await sendFeedbackRequest(payload);

  return { status: sent ? "success" : "error" };
}

/**
 * Composes the generic waitlist primitives for prompt intents and reusable course
 * formats that the router can identify today but the generation workflow cannot
 * build yet.
 */
export function CoursePromptWaitlistForm({
  coursePrompt,
  defaultEmail,
  prompt,
  title,
}: {
  coursePrompt: UnsupportedCoursePrompt;
  defaultEmail?: string | null;
  prompt: string;
  title: string;
}) {
  const t = useExtracted();

  return (
    <WaitlistForm action={coursePromptWaitlistAction}>
      <input name="courseFormat" type="hidden" value={coursePrompt.courseFormat ?? ""} />
      <input name="prompt" type="hidden" value={prompt} />
      <input name="intent" type="hidden" value={coursePrompt.intent} />
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
