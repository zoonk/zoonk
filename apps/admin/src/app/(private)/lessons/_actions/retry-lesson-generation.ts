"use server";

import { assertAdmin } from "@/lib/admin-guard";
import { safeAsync } from "@zoonk/utils/error";
import { parseFormField } from "@zoonk/utils/form";
import { API_URL } from "@zoonk/utils/url";
import { isUuid } from "@zoonk/utils/uuid";
import { revalidatePath } from "next/cache";

const API_ORIGIN = new URL(API_URL).origin;

export type RetryLessonGenerationState = {
  error: string | null;
  status: "idle" | "error" | "success";
  submissionId: number;
};

/**
 * Starts a fresh workflow run through the public generation capability so the
 * admin button shares the API's validation and atomic lesson claim behavior.
 */
export async function retryLessonGenerationAction(
  previousState: RetryLessonGenerationState,
  formData: FormData,
): Promise<RetryLessonGenerationState> {
  const session = await assertAdmin();
  const submissionId = previousState.submissionId + 1;
  const lessonId = parseFormField(formData, "lessonId");

  if (!isUuid(lessonId)) {
    return { error: "Invalid lesson.", status: "error", submissionId };
  }

  const { data: response, error } = await safeAsync(() =>
    fetch(`${API_URL}/v1/generations`, {
      body: JSON.stringify({ target: { id: lessonId, type: "lesson" } }),
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${session.session.token}`,
        "Content-Type": "application/json",
        Origin: API_ORIGIN,
      },
      method: "POST",
    }),
  );

  if (error || !response?.ok) {
    return {
      error: "Could not start lesson generation. Please try again.",
      status: "error",
      submissionId,
    };
  }

  revalidatePath("/lessons");
  revalidatePath(`/lessons/${lessonId}`);

  return { error: null, status: "success", submissionId };
}
