"use client";

import { sendFeedbackRequest } from "@/components/feedback/feedback-request";
import {
  WaitlistField,
  WaitlistFieldDescription,
  WaitlistFieldLabel,
  WaitlistForm,
  WaitlistInput,
  type WaitlistState,
  WaitlistStatus,
  WaitlistSubmit,
} from "@/components/waitlist/waitlist";
import { parseFormField } from "@zoonk/utils/form";
import { useExtracted } from "next-intl";

const EXAM_WAITLIST_MESSAGE_PREFIX = "Exam waitlist request";

/**
 * Converts the exam waitlist fields into the generic feedback payload the API
 * already accepts, while keeping the outbound email easy to scan.
 */
function getExamWaitlistPayload(formData: FormData) {
  const email = parseFormField(formData, "email");
  const exam = parseFormField(formData, "exam");

  if (!(email && exam)) {
    return null;
  }

  return { email, message: `${EXAM_WAITLIST_MESSAGE_PREFIX}\n\nExam: ${exam}` };
}

/**
 * Handles exam waitlist submissions in the browser so the flow uses the same
 * feedback endpoint contract and e2e mocking path as the existing support form.
 */
async function examWaitlistAction(
  _prevState: WaitlistState,
  formData: FormData,
): Promise<WaitlistState> {
  const payload = getExamWaitlistPayload(formData);

  if (!payload) {
    return { status: "error" };
  }

  const sent = await sendFeedbackRequest(payload);

  return { status: sent ? "success" : "error" };
}

/**
 * Composes the generic waitlist primitives for exam prep without forcing the
 * server page to know the client-side feedback submission details.
 */
export function ExamWaitlistForm() {
  const t = useExtracted();

  return (
    <WaitlistForm action={examWaitlistAction}>
      <WaitlistField>
        <WaitlistFieldLabel>{t("Email address")}</WaitlistFieldLabel>
        <WaitlistInput
          autoComplete="email"
          name="email"
          placeholder={t("myemail@gmail.com")}
          required
          type="email"
        />
        <WaitlistFieldDescription>
          {t("We'll use this email to notify you when exam prep is ready.")}
        </WaitlistFieldDescription>
      </WaitlistField>

      <WaitlistField>
        <WaitlistFieldLabel>{t("Exam")}</WaitlistFieldLabel>
        <WaitlistInput
          name="exam"
          placeholder={t("TOEFL, SAT, CFA, CPA...")}
          required
          type="text"
        />
        <WaitlistFieldDescription>
          {t("Tell us the test, certification, or school exam you care about.")}
        </WaitlistFieldDescription>
      </WaitlistField>

      <WaitlistStatus
        errorMessage={t("We couldn't add you to the waitlist. Please try again.")}
        successMessage={t("You're on the list. We'll let you know when exam prep is ready.")}
      />

      <WaitlistSubmit full>{t("Notify me")}</WaitlistSubmit>
    </WaitlistForm>
  );
}
