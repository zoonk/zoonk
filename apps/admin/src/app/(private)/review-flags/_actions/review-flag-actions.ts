"use server";

import { postAdminApi } from "@/lib/admin-api";
import { assertAdmin } from "@/lib/admin-guard";
import { type AdminActionState } from "@/lib/use-admin-action-state";
import { dismissReviewFlagForAdmin } from "@zoonk/core/library/review-flags/admin";
import { parseFormField } from "@zoonk/utils/form";
import { isUuid } from "@zoonk/utils/uuid";
import { revalidatePath } from "next/cache";

export type ReviewFlagActionState = AdminActionState & { message: string | null };

export async function dismissReviewFlagAction(
  previousState: ReviewFlagActionState,
  formData: FormData,
): Promise<ReviewFlagActionState> {
  await assertAdmin();
  const submissionId = previousState.submissionId + 1;
  const flagId = parseFormField(formData, "flagId");

  if (!isUuid(flagId)) {
    return { error: "Invalid flag.", message: null, submissionId };
  }

  const result = await dismissReviewFlagForAdmin(flagId);

  if (result.status !== "ready") {
    return { error: "Could not dismiss this flag.", message: null, submissionId };
  }

  revalidatePath("/review-flags");
  return { error: null, message: "Dismissed.", submissionId };
}

/** The API may be down locally, so a failed call returns an error message instead of throwing. */
export async function rewriteReviewFlagAction(
  previousState: ReviewFlagActionState,
  formData: FormData,
): Promise<ReviewFlagActionState> {
  const session = await assertAdmin();
  const submissionId = previousState.submissionId + 1;
  const flagId = parseFormField(formData, "flagId");

  if (!isUuid(flagId)) {
    return { error: "Invalid flag.", message: null, submissionId };
  }

  const response = await postAdminApi({
    body: {},
    path: `/v1/library/review-flags/${flagId}/rewrites`,
    sessionToken: session.session.token,
  });

  if (!response.ok) {
    return {
      error: "Could not start the rewrite. Check that the API is running.",
      message: null,
      submissionId,
    };
  }

  revalidatePath("/review-flags");
  return { error: null, message: "Rewrite started.", submissionId };
}
