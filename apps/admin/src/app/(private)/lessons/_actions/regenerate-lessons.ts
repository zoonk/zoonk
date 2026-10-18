"use server";

import { postAdminApi } from "@/lib/admin-api";
import { assertAdmin } from "@/lib/admin-guard";
import { parseFormField } from "@zoonk/utils/form";
import { revalidatePath } from "next/cache";

export type RegenerateLessonsState = {
  error: string | null;
  regenerated: number | null;
  submissionId: number;
};

function readLessonCount(data: unknown): number {
  if (typeof data === "object" && data !== null && "lessonIds" in data) {
    return Array.isArray(data.lessonIds) ? data.lessonIds.length : 0;
  }

  return 0;
}

/**
 * Rewrites the lessons a model or prompt version wrote, through the API that owns the writing
 * workflow. Each click takes a bounded batch, so a large set is rewritten in steps an admin sees.
 */
export async function regenerateLessonsAction(
  previousState: RegenerateLessonsState,
  formData: FormData,
): Promise<RegenerateLessonsState> {
  const session = await assertAdmin();
  const submissionId = previousState.submissionId + 1;
  const model = parseFormField(formData, "model") || undefined;
  const promptVersion = parseFormField(formData, "promptVersion") || undefined;

  if (!(model || promptVersion)) {
    return { error: "Pick a model or a prompt version first.", regenerated: null, submissionId };
  }

  const response = await postAdminApi({
    body: { model, promptVersion },
    path: "/v1/library/lessons/regenerations",
    sessionToken: session.session.token,
  });

  if (!response.ok) {
    return {
      error: "Could not start the rewrite. Please try again.",
      regenerated: null,
      submissionId,
    };
  }

  revalidatePath("/lessons");

  return { error: null, regenerated: readLessonCount(response.data), submissionId };
}
